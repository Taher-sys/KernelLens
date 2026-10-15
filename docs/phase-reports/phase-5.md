# Phase 5 Report — Disk Scheduling & Memory Allocators

**Course:** Operating Systems Lab (AID20090), Third Year CSE / AI-DS, Semester V, 2026-27
**Project:** KernelLens — Deterministic Discrete-Event OS Simulation Laboratory
**Document:** `docs/phase-reports/phase-5.md`
**Status:** Complete — 6 disk schedulers and contiguous memory allocators implemented and tested

---

## 1. Implementation Summary

Phase 5 implements disk head scheduling algorithms and contiguous memory allocation policies. Both subsystems operate deterministically without native threads or hardware dependencies.

### Deliverables

| Component | Path | Status |
|-----------|------|--------|
| Disk scheduler interface | `engine/include/kernellens/disk/disk_scheduler.hpp` | Complete |
| 6 disk schedulers | `engine/include/kernellens/disk/schedulers.hpp`, `engine/src/disk/schedulers.cpp` | Complete |
| Memory allocator interface | `engine/include/kernellens/memory/allocator.hpp` | Complete |
| Contiguous allocator | `engine/src/memory/allocator.cpp` | Complete |
| Golden tests | `tests/golden/test_golden_disk.cpp` | Complete |
| Unit tests | `tests/unit/test_disk.cpp`, `tests/unit/test_allocator.cpp` | Complete |

---

## 2. Disk Scheduling Interface

**File:** `engine/include/kernellens/disk/disk_scheduler.hpp`

### Head Direction

```cpp
enum class HeadDirection {
  Up,   // Increasing cylinder numbers (towards max)
  Down  // Decreasing cylinder numbers (towards 0)
};
```

### Result Structure

```cpp
struct DiskScheduleResult {
  std::vector<std::uint32_t> service_order;
  std::uint64_t total_seek_distance = 0;
  std::string to_json() const;
};
```

### Scheduler Interface

```cpp
class IDiskScheduler {
public:
  virtual ~IDiskScheduler() = default;

  virtual std::string name() const = 0;
  virtual DiskScheduleResult schedule(std::uint32_t initial_head,
                                      HeadDirection direction,
                                      std::uint32_t max_cylinder,
                                      const std::vector<std::uint32_t>& requests,
                                      EventLog* log = nullptr) = 0;
};
```

---

## 3. Disk Scheduling Algorithms

### 3.1 FCFS (First-Come First-Served)

**Behavior:** Services requests in arrival order.

```cpp
for (std::uint32_t req : requests) {
  result.total_seek_distance += std::abs(req - current);
  result.service_order.push_back(req);
  current = req;
}
```

**Characteristics:** No optimization, simple O(N) scan, can cause long seeks.

**Textbook verification:** Queue [98, 183, 37, 122, 14, 124, 65, 67], head=53 → **640 cylinders**

### 3.2 SSTF (Shortest Seek Time First)

**Behavior:** Always selects the request closest to current head position.

```cpp
while (!pending.empty()) {
  // Find request with minimum distance to current head
  auto best_it = std::min_element(pending.begin(), pending.end(),
    [current](auto a, auto b) {
      return std::abs(a - current) < std::abs(b - current);
    });
  // Service that request
}
```

**Tie-breaking:** When distances equal, select lower cylinder number.

**Textbook verification:** Same queue → **236 cylinders** (dramatic improvement over FCFS)

### 3.3 SCAN (Elevator)

**Behavior:** Head moves in one direction, servicing all requests until boundary, then reverses.

**Algorithm (direction=Up):**
1. Service all requests ≥ initial_head in ascending order
2. Move to max_cylinder boundary (counted in seek distance)
3. Reverse direction
4. Service all requests < initial_head in descending order

**Boundary behavior:** Must visit disk boundary (0 or max_cylinder) before reversing.

**Textbook verification:** Same queue, head=53, max=199 → **331 cylinders**

### 3.4 C-SCAN (Circular SCAN)

**Behavior:** One-way elevator—services in one direction, then wraps to other end.

**Algorithm (direction=Up):**
1. Service all requests ≥ initial_head in ascending order
2. Move to max_cylinder
3. **Wrap** to cylinder 0 (seek distance includes wrap)
4. Service all requests < initial_head in ascending order

**Wrap cost:** Seek from max_cylinder to 0 is counted in total distance.

**Characteristic:** More uniform wait time than SCAN.

### 3.5 LOOK

**Behavior:** Like SCAN, but reverses at last request instead of disk boundary.

**Algorithm (direction=Up):**
1. Service all requests ≥ initial_head in ascending order
2. **No boundary visit**—reverse immediately
3. Service all requests < initial_head in descending order

**Optimization:** Avoids unnecessary seeks to empty regions.

**Textbook verification:** Same queue → **299 cylinders** (better than SCAN's 331)

### 3.6 C-LOOK

**Behavior:** Like C-SCAN, but wraps at last request instead of boundary.

**Algorithm (direction=Up):**
1. Service all requests ≥ initial_head in ascending order
2. Jump to lowest request (wrap counted in seek)
3. Service all requests < initial_head in ascending order

**Characteristic:** Combines LOOK optimization with C-SCAN uniformity.

---

## 4. Event Emission

```cpp
emit_disk_step(log, tick, from, to, accumulated_seek, policy);
```

Emits `disk_request_serviced` event with:
- `fromCylinder`: Previous head position
- `toCylinder`: New head position
- `distance`: Seek distance for this step
- `accumulatedSeek`: Running total
- `policy`: Scheduler name

---

## 5. Memory Allocator Interface

**File:** `engine/include/kernellens/memory/allocator.hpp`

### Block Structure

```cpp
struct MemoryBlock {
  std::uint32_t id = 0;
  std::size_t start = 0;
  std::size_t size = 0;
  bool allocated = false;
  std::optional<std::uint32_t> owner = std::nullopt;
};
```

### Allocation Result

```cpp
struct AllocationResult {
  bool success = false;
  std::optional<std::uint32_t> block_id = std::nullopt;
  std::size_t requested = 0;
  std::size_t allocated = 0;
  std::size_t external_fragmentation = 0;
  std::string reason;
};
```

### Allocation Policies

```cpp
enum class AllocationPolicy {
  FirstFit,
  BestFit,
  WorstFit
};
```

### Allocator Interface

```cpp
class IMemoryAllocator {
public:
  virtual std::string name() const = 0;
  virtual AllocationResult allocate(std::uint32_t owner, std::size_t bytes, Tick now = 0) = 0;
  virtual bool deallocate(std::uint32_t owner, Tick now = 0) = 0;
  virtual std::vector<MemoryBlock> snapshot() const = 0;
  virtual std::size_t total_free() const = 0;
  virtual std::size_t total_capacity() const = 0;
  virtual void reset() = 0;
};
```

---

## 6. Allocation Policies

### 6.1 First-Fit

**Behavior:** Allocates from the first hole large enough to satisfy the request.

```cpp
for (auto& block : blocks_) {
  if (!block.allocated && block.size >= bytes) {
    // Split block if remainder > 0
    // Allocate here
    return success;
  }
}
```

**Complexity:** O(F) where F = number of blocks

**Advantage:** Fast allocation

**Disadvantage:** Creates small fragments at beginning of memory

### 6.2 Best-Fit

**Behavior:** Allocates from the smallest hole that satisfies the request.

```cpp
MemoryBlock* best = nullptr;
for (auto& block : blocks_) {
  if (!block.allocated && block.size >= bytes) {
    if (!best || block.size < best->size) {
      best = &block;
    }
  }
}
```

**Complexity:** O(F) — must scan all blocks

**Advantage:** Minimizes wasted space per allocation

**Disadvantage:** Creates many small, unusable fragments

### 6.3 Worst-Fit

**Behavior:** Allocates from the largest hole.

```cpp
MemoryBlock* worst = nullptr;
for (auto& block : blocks_) {
  if (!block.allocated && block.size >= bytes) {
    if (!worst || block.size > worst->size) {
      worst = &block;
    }
  }
}
```

**Complexity:** O(F) — must scan all blocks

**Advantage:** Leaves larger remaining fragments

**Disadvantage:** May exhaust large blocks quickly

---

## 7. Coalescing

When a block is deallocated, adjacent free blocks are merged:

```cpp
void coalesce() {
  for (std::size_t i = 0; i < blocks_.size() - 1; ++i) {
    if (!blocks_[i].allocated && !blocks_[i+1].allocated) {
      blocks_[i].size += blocks_[i+1].size;
      blocks_.erase(blocks_.begin() + i + 1);
      --i;  // Re-check this position
    }
  }
}
```

**Test verification:** Allocate P1(200), P2(300), deallocate both → single 1000-byte block

---

## 8. Fragmentation Detection

### External Fragmentation

When allocation fails despite sufficient total free memory:

```cpp
// Total free: 400 bytes (two 200-byte holes)
// Request: 350 bytes
// Result: FAIL, external_fragmentation = 400
```

**Test:** `Allocator_ExternalFragmentationDetection` verifies this scenario.

### Internal Fragmentation

When allocated block is larger than requested (not currently tracked separately).

---

## 9. Test Results

### Golden Tests (`tests/golden/test_golden_disk.cpp`)

| Test | Description | Verification | Status |
|------|-------------|--------------|--------|
| `Golden_Disk_Textbook_FCFS_SSTF_LOOK` | Silberschatz queue | FCFS=640, SSTF=236, LOOK=299 | PASS |

**Seek distance invariant:** SSTF (236) < LOOK (299) < FCFS (640)

### Unit Tests (`tests/unit/test_disk.cpp`)

| Test | Description | Status |
|------|-------------|--------|
| `Disk_DirectionAndBounds` | SCAN direction reversal at boundary | PASS |
| `Workload_DeterministicSeed` | PRNG reproducibility | PASS |

### Unit Tests (`tests/unit/test_allocator.cpp`)

| Test | Description | Status |
|------|-------------|--------|
| `Allocator_FirstFit_And_Coalesce` | Allocation and hole coalescing | PASS |
| `Allocator_ExternalFragmentationDetection` | Fragmentation when allocation fails | PASS |

### Execution Output

```
Running test: Golden_Disk_Textbook_FCFS_SSTF_LOOK...
 [PASS] Golden_Disk_Textbook_FCFS_SSTF_LOOK
Running test: Disk_DirectionAndBounds...
 [PASS] Disk_DirectionAndBounds
Running test: Workload_DeterministicSeed...
 [PASS] Workload_DeterministicSeed
Running test: Allocator_FirstFit_And_Coalesce...
 [PASS] Allocator_FirstFit_And_Coalesce
Running test: Allocator_ExternalFragmentationDetection...
 [PASS] Allocator_ExternalFragmentationDetection
```

---

## 10. Complexity Analysis

### Disk Schedulers

| Algorithm | Time Complexity | Space |
|-----------|-----------------|-------|
| FCFS | O(N) | O(N) |
| SSTF | O(N²) | O(N) |
| SCAN | O(N log N) | O(N) |
| C-SCAN | O(N log N) | O(N) |
| LOOK | O(N log N) | O(N) |
| C-LOOK | O(N log N) | O(N) |

### Memory Allocators

| Policy | Allocation | Deallocation | Space |
|--------|------------|--------------|-------|
| First-Fit | O(F) | O(F) with coalesce | O(F) |
| Best-Fit | O(F) | O(F) with coalesce | O(F) |
| Worst-Fit | O(F) | O(F) with coalesce | O(F) |

Where F = number of blocks.

---

## 11. CLI Integration

```
.\build\bin\kernellens.exe --module disk --policy FCFS
.\build\bin\kernellens.exe --module disk --policy SSTF
.\build\bin\kernellens.exe --module disk --policy SCAN
.\build\bin\kernellens.exe --module disk --policy C-SCAN
.\build\bin\kernellens.exe --module disk --policy LOOK
.\build\bin\kernellens.exe --module disk --policy C-LOOK
```

Output shows service order and total seek distance.

---

## 12. Acceptance Criteria Verification

| Criterion | Requirement | Status |
|-----------|-------------|--------|
| 6 disk schedulers | FCFS, SSTF, SCAN, C-SCAN, LOOK, C-LOOK | ✓ Complete |
| Cylinder range | Configurable initial_head, max_cylinder | ✓ Complete |
| Direction handling | Up/Down with proper reversal | ✓ Tested |
| Seek distance | Accumulated total verified | ✓ Textbook match |
| 3 allocation policies | First-Fit, Best-Fit, Worst-Fit | ✓ Complete |
| Hole coalescing | Adjacent free blocks merge | ✓ Tested |
| Fragmentation detection | External fragmentation reported | ✓ Tested |
| Event emission | disk_request_serviced emitted | ✓ Complete |

---

## 13. Dependencies

- Phase 1: Core clock, event log
- Phase 0: Architecture specification

---

## 14. Next Phase

Phase 6: D3.js Animated Frontend
- React + Vite + TypeScript + D3.js
- CPU Gantt chart with scrubbing
- Memory frame visualization
- RAG cycle highlighting
- Disk head trajectory animation
- Multi-policy comparison matrix
