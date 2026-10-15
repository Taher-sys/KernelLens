# Phase 3 Report — Virtual Memory & Paging

**Course:** Operating Systems Lab (AID20090), Third Year CSE / AI-DS, Semester V, 2026-27
**Project:** KernelLens — Deterministic Discrete-Event OS Simulation Laboratory
**Document:** `docs/phase-reports/phase-3.md`
**Status:** Complete — All page replacement algorithms, TLB, and allocators implemented and tested

---

## 1. Implementation Summary

Phase 3 implements the complete virtual memory subsystem including four page replacement algorithms, TLB cache simulation, and contiguous memory allocators with fragmentation detection.

### Deliverables

| Component | Path | Status |
|-----------|------|--------|
| IPageReplacer interface | `engine/include/kernellens/memory/page_replacer.hpp` | Complete |
| FIFO replacer | `engine/src/memory/replacers.cpp` | Complete |
| LRU replacer | `engine/src/memory/replacers.cpp` | Complete |
| Optimal (MIN) replacer | `engine/src/memory/replacers.cpp` | Complete |
| Clock (second-chance) replacer | `engine/src/memory/replacers.cpp` | Complete |
| Paging system | `engine/include/kernellens/memory/paging_system.hpp`, `engine/src/memory/paging_system.cpp` | Complete |
| TLB cache | `engine/include/kernellens/memory/tlb.hpp` | Complete |
| Contiguous allocator | `engine/include/kernellens/memory/allocator.hpp`, `engine/src/memory/allocator.cpp` | Complete |
| Golden tests | `tests/golden/test_golden_memory.cpp` | Complete |
| Unit tests | `tests/unit/test_memory.cpp`, `tests/unit/test_allocator.cpp` | Complete |

---

## 2. Page Replacement Interface

All page replacement algorithms implement `IPageReplacer`:

```cpp
class IPageReplacer {
public:
  virtual ~IPageReplacer() = default;

  virtual std::string name() const = 0;
  virtual std::size_t choose_victim(const std::vector<Frame>& frames,
                                    const PageAccessContext& context) = 0;
  virtual void on_hit(std::size_t frame_index, const PageAccessContext& context) = 0;
  virtual void on_load(std::size_t frame_index, std::uint32_t page,
                       const PageAccessContext& context) = 0;
  virtual void reset() = 0;
};
```

The `PageAccessContext` provides:
- `time`: Current simulation tick
- `reference_index`: Index in the reference string
- `future_references`: Pointer to remaining reference sequence (used by Optimal)

---

## 3. Page Replacement Algorithms

### 3.1 FIFO (First-In First-Out)

**Implementation:** `FifoReplacer` in `engine/src/memory/replacers.cpp`

- **Data structure:** `std::deque<std::size_t>` tracking frame load order
- **Victim selection:** Evicts the frame that has been in memory the longest
- **Characteristics:** Simple O(1) eviction, but suffers from Belady's Anomaly

**Belady's Anomaly Verified:**
- Reference string: `[1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5]`
- 3 frames → 9 page faults
- 4 frames → 10 page faults (counterintuitive increase!)

### 3.2 LRU (Least Recently Used)

**Implementation:** `LruReplacer` in `engine/src/memory/replacers.cpp`

- **Data structure:** Uses `Frame::last_used_at` timestamp
- **Victim selection:** Evicts the frame with oldest `last_used_at`
- **Characteristics:** O(1) eviction, exhibits stack property (no Belady's Anomaly)
- **Stack property:** Frames at time T are a subset of frames at time T+1

### 3.3 Optimal (MIN)

**Implementation:** `OptimalReplacer` in `engine/src/memory/replacers.cpp`

- **Data structure:** Future reference string passed via `PageAccessContext`
- **Victim selection:** Evicts the page not used for the longest time in the future
- **Algorithm:**
  1. For each frame, scan forward in reference string
  2. Find page with furthest (or never) next reference
  3. Evict that page
- **Characteristics:** Theoretically optimal, requires future knowledge (unimplementable in practice)

**Optimality Invariant Verified:**
For the textbook reference string `[7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2, 1, 2, 0, 1, 7, 0, 1]` with 3 frames:
- FIFO: 15 faults
- LRU: 12 faults
- Optimal: 9 faults

**Property:** `faults(Optimal) ≤ faults(LRU) ≤ faults(FIFO)` verified in golden test.

### 3.4 Clock (Second-Chance)

**Implementation:** `ClockReplacer` in `engine/src/memory/replacers.cpp`

- **Data structure:** Circular hand pointer (`hand_`), reference bit per frame
- **Victim selection:**
  1. Hand sweeps through frames circularly
  2. If reference bit = 1, clear it and move on (second chance)
  3. If reference bit = 0, evict that frame
- **Characteristics:** O(M) worst-case where M = number of frames, approximates LRU

---

## 4. TLB Cache

**Implementation:** `TLB` class in `engine/include/kernellens/memory/tlb.hpp`

```cpp
class TLB {
public:
  explicit TLB(std::size_t capacity = 4);

  std::optional<std::size_t> lookup(std::uint32_t page, Tick now);
  void insert(std::uint32_t page, std::size_t frame, Tick now);
  void invalidate(std::uint32_t page);

  std::size_t hits() const noexcept;
  std::size_t misses() const noexcept;
  double hit_ratio() const noexcept;
  void reset();
};
```

- **Replacement policy:** LRU eviction when full
- **Entry structure:** `{page, frame, last_access}`
- **Capacity:** Configurable (default: 4 entries, 0 = disabled)

**Test Verification:**
- Insert 2 entries, verify hit on lookup
- Insert 3rd entry with capacity 2, verify LRU eviction
- Verify miss on evicted page

---

## 5. Paging System

**Implementation:** `PagingSystem` class in `engine/src/memory/paging_system.cpp`

Integrates TLB, frames, and page replacement into a unified interface:

```cpp
class PagingSystem {
public:
  PagingSystem(std::size_t num_frames, std::unique_ptr<IPageReplacer> replacer,
               std::size_t tlb_capacity = 4, EventLog* log = nullptr);

  PagingAccessResult access(Tick now, std::uint32_t page, std::size_t ref_index,
                            const std::vector<std::uint32_t>& future_references);

  const PagingMetrics& metrics() const noexcept;
};
```

**Access Flow:**
1. Check TLB for page → hit returns frame immediately
2. Scan frames for page → hit updates metadata, returns
3. Page fault: call `choose_victim()`, evict if needed, load page

**PagingMetrics:**
```cpp
struct PagingMetrics {
  std::size_t total_accesses;
  std::size_t page_faults;
  std::size_t tlb_hits;
  std::size_t tlb_misses;
  double fault_rate;
  double tlb_hit_rate;
};
```

---

## 6. Contiguous Memory Allocators

**Implementation:** `ContiguousAllocator` in `engine/src/memory/allocator.cpp`

### Allocation Policies

| Policy | Selection Strategy | Complexity |
|--------|-------------------|------------|
| First-Fit | First hole ≥ request | O(F) |
| Best-Fit | Smallest hole ≥ request | O(F) |
| Worst-Fit | Largest hole | O(F) |

### Features

- **Hole coalescing:** Adjacent free blocks merge automatically on deallocation
- **Fragmentation detection:** `AllocationResult.external_fragmentation` reports total free memory when allocation fails
- **Owner tracking:** Each block tracks which process owns it

### External Fragmentation Example

```cpp
// Allocate P1(300), P2(200), P3(300), P4(200)
// Free P2 and P4 → 400 bytes free, but largest hole = 200
// Allocate 350 → FAILS (external fragmentation = 400)
```

---

## 7. Test Results

### Golden Tests (`tests/golden/test_golden_memory.cpp`)

| Test | Description | Verification | Status |
|------|-------------|--------------|--------|
| `Golden_BeladyAnomaly_FIFO` | Classic Belady sequence | 3 frames=9 faults, 4 frames=10 faults | PASS |
| `Golden_TextbookComparison_FIFO_LRU_Optimal` | Silberschatz reference string | FIFO=15, LRU=12, Optimal=9 | PASS |

### Unit Tests (`tests/unit/test_memory.cpp`)

| Test | Description | Status |
|------|-------------|--------|
| `TLB_HitAndMiss` | TLB lookup, insert, LRU eviction | PASS |
| `Memory_ClockSecondChance` | Clock hand movement, second chance | PASS |

### Unit Tests (`tests/unit/test_allocator.cpp`)

| Test | Description | Status |
|------|-------------|--------|
| `Allocator_FirstFit_And_Coalesce` | Allocation and hole coalescing | PASS |
| `Allocator_ExternalFragmentationDetection` | Fragmentation detection when allocation fails | PASS |

### Execution Output

```
Running test: Golden_BeladyAnomaly_FIFO...
 [PASS] Golden_BeladyAnomaly_FIFO
Running test: Golden_TextbookComparison_FIFO_LRU_Optimal...
 [PASS] Golden_TextbookComparison_FIFO_LRU_Optimal
Running test: TLB_HitAndMiss...
 [PASS] TLB_HitAndMiss
Running test: Memory_ClockSecondChance...
 [PASS] Memory_ClockSecondChance
Running test: Allocator_FirstFit_And_Coalesce...
 [PASS] Allocator_FirstFit_And_Coalesce
Running test: Allocator_ExternalFragmentationDetection...
 [PASS] Allocator_ExternalFragmentationDetection
```

---

## 8. Complexity Analysis

| Algorithm | `choose_victim()` | `on_hit()` | `on_load()` | Space |
|-----------|-------------------|------------|-------------|-------|
| FIFO | O(1) | O(1) | O(1) | O(M) |
| LRU | O(M) | O(1) | O(1) | O(M) |
| Optimal | O(M × L) | O(1) | O(1) | O(M) |
| Clock | O(M) worst, O(1) amortized | O(1) | O(1) | O(M) |

Where M = number of frames, L = remaining reference string length.

---

## 9. Event Emission

The paging system emits the following events (when `EventLog` is provided):

| Event Type | Subsystem | When Emitted |
|------------|-----------|--------------|
| `page_access` | memory | Every memory reference |
| `tlb_hit` | memory | TLB lookup succeeds |
| `tlb_miss` | memory | TLB lookup fails |
| `page_fault` | memory | Page not in frames |
| `frame_evicted` | memory | Frame replaced |
| `frame_loaded` | memory | Page loaded into frame |
| `allocation_succeeded` | memory | Memory block allocated |
| `allocation_failed` | memory | Allocation request denied |

---

## 10. Acceptance Criteria Verification

| Criterion | Requirement | Status |
|-----------|-------------|--------|
| 4 page replacement algorithms | FIFO, LRU, Optimal, Clock | ✓ Complete |
| Belady's Anomaly demonstration | 3 frames < 4 frames for FIFO | ✓ Verified (9 < 10) |
| Optimal optimality property | faults(Optimal) ≤ faults(LRU) | ✓ Verified |
| TLB simulation | Hit/miss tracking, LRU eviction | ✓ Complete |
| Contiguous allocators | First-Fit, Best-Fit, Worst-Fit | ✓ Complete |
| Hole coalescing | Adjacent free blocks merge | ✓ Verified |
| Fragmentation detection | External fragmentation reported | ✓ Verified |

---

## 11. Dependencies

- Phase 1: Core clock, event log, process runtime
- Phase 2: CPU scheduling (shared process model)
- Phase 0: Architecture specification, event schema

---

## 11. Frontend Memory Lab Integration & D3 Visualizations

As required, memory engine results and events are connected directly to the React/TypeScript frontend without duplicating or reimplementing any page replacement algorithm in TypeScript.

### 11.1 Component Contracts & Features
- **[`FrameGrid.tsx`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/frontend/src/features/memory/FrameGrid.tsx)**:
  - Visualizes physical memory frames with clear residency, loaded tick, last used tick, and reference bit tags.
  - **Accessible Page Fault Marker**: Displays high-contrast accessible markers (`role="status"`, `aria-label`, red visual badge) whenever a page fault occurs, showing the incoming page and victim evicted page.
  - Empty state: Safely renders fallback message when `frames` is empty.
- **[`FaultTimeline.tsx`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/frontend/src/features/memory/FaultTimeline.tsx)**:
  - D3.js visualization plotting page reference sequence on the X-axis against Hit vs Fault states and TLB hit indicators.
  - Interactive click-to-seek timeline scrubber tied to `currentTick`.
- **[`TlbPanel.tsx`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/frontend/src/features/memory/TlbPanel.tsx)**:
  - Displays TLB cache fast-path slots (Page $\rightarrow$ Frame translation), live hit/miss badges, and quantitative metrics (Hits, Misses, Hit Rate %).
- **[`MemoryLab.tsx`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/frontend/src/features/memory/MemoryLab.tsx)**:
  - Connects controls, D3 `FaultTimeline`, `FrameGrid`, `TlbPanel`, and raw event logs.
  - **Explicit "engine not connected" state**: When un-cached/custom workloads are requested without an active live C++ engine backend, displays the explicit banner: `"engine not connected"`.
  - **Zero TypeScript Simulation**: Strictly consumes C++ event logs; no page replacement logic exists in TypeScript.

### 11.2 Memory Automated Test Verification (`npm run test:memory`)
```text
> kernellens-frontend@1.0.0 test:memory
> tsx src/tests/memory.test.ts

========================================================
   Running KernelLens Memory UI & Contract Tests        
========================================================

Test 1: Validating empty data and zero-capacity handling...
 [PASS] Empty data structures correctly handled without error.

Test 2: Validating explicit "engine not connected" state for un-cached workloads...
 [PASS] "engine not connected" explicit state verified; no TypeScript simulation executed.

Test 3: Validating real C++ Belady Anomaly event sequence...
 [PASS] C++ Belady Anomaly sequence verified (3 frames = 9 faults, 4 frames = 10 faults).

Test 4: Validating real C++ textbook comparison sequence (FIFO vs LRU vs Optimal)...
 [PASS] Textbook comparison sequence verified: Optimal (9) <= LRU (12) <= FIFO (15).

Test 5: Verifying accessible page fault marker metadata...
 [PASS] Page fault and eviction accessible metadata validated.

========================================================
   ALL MEMORY UI & CONTRACT TESTS PASSED (5/5)          
========================================================
```

---

## 12. Next Phase

Phase 4: Synchronization & Deadlocks
- Semaphore and mutex primitives
- Resource Allocation Graph (RAG) with cycle detection
- Banker's Algorithm for deadlock avoidance

