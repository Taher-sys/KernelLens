# Phase 9 Report — Dynamic Memory Allocation, Buddy System & Fragmentation Simulation

**Course:** Operating Systems Lab (AID20090), Third Year CSE / AI-DS, Semester V, 2026–27  
**Project:** KernelLens — Deterministic Discrete-Event OS Simulation Laboratory  
**Document:** `docs/phase-reports/phase-9.md`  
**Status:** Complete — Contiguous allocation policies (First-Fit, Best-Fit, Worst-Fit), Binary Buddy Allocator, memory compaction, internal/external fragmentation accounting, multi-policy allocator comparison engine, and CLI demonstration implemented and verified (52/52 tests passing).

---

## 1. Executive Summary

Phase 9 completes the memory management pillar of KernelLens by introducing deterministic simulation of dynamic memory allocation and fragmentation. While Phase 3 focused on virtual memory paging and page replacement (FIFO, LRU, Optimal, Clock), Phase 9 models physical heap and segment allocation at byte-level granularity.

Phase 9 delivers:
1. **Contiguous Memory Allocation (`ContiguousAllocator`)**:
   - Implements **First-Fit**, **Best-Fit**, and **Worst-Fit** allocation policies over a contiguous byte buffer.
   - Exact-fit block placement without unnecessary splits.
   - Automatic coalescing of adjacent free blocks upon deallocation.
   - Memory compaction (`compact()`) that linearly relocates active blocks to offset 0, uniting scattered fragments into a single contiguous hole and completely eliminating external fragmentation.
2. **Binary Buddy Allocator (`BuddyAllocator`)**:
   - Power-of-two block allocation with configurable minimum block size (default 16 bytes).
   - Recursive block splitting ($1024 \to 512 \to 256 \to 128 \to \dots$) down to the required order $k = \lceil \log_2(\text{bytes}) \rceil$.
   - Recursive buddy coalescing upon deallocation using strict address XOR alignment:
     $$\text{Buddy}(A, 2^k) = A \oplus 2^k$$
     Ensures that adjacent blocks of identical size only coalesce if they form an authentic buddy pair.
3. **Formal Fragmentation Accounting**:
   - Explicit separation between internal fragmentation (bytes reserved but unused by the owner) and external fragmentation (free bytes scattered across holes too small to satisfy requests).
   - External fragmentation ratio: $\Phi_{\text{ext}} = \frac{\text{Total Free} - \text{Largest Free Block}}{\text{Total Free}}$.
4. **Multi-Policy Comparative Analysis (`ComparisonEngine::compare_allocator`)**:
   - Evaluates First-Fit, Best-Fit, Worst-Fit, and Buddy allocators against identical operation workloads.
   - Computes mathematical deltas ($\Delta$), relative percentage changes, composite rankings, and performance badges (`Lowest Failures`, `Lowest Internal Frag`, `Lowest External Frag`, `Highest Utilization`).
5. **Deterministic Native CLI & JSON Serialization**:
   - `--module allocator --policy <NAME>` for single-policy execution with block layout and metrics.
   - `--compact` flag demonstrating post-workload compaction.
   - `--compare --module allocator` emitting comparative tables, JSON (`schemaVersion: 1`), and CSV.

---

## 2. Core Architectural Deliverables

| Deliverable | Path | Description |
| :--- | :--- | :--- |
| Allocator Header | [`engine/include/kernellens/memory/allocator.hpp`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/engine/include/kernellens/memory/allocator.hpp) | Declares `IMemoryAllocator`, `MemoryBlock`, `MemoryMetrics`, `ContiguousAllocator`, and `BuddyAllocator`. |
| Allocator Implementation | [`engine/src/memory/allocator.cpp`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/engine/src/memory/allocator.cpp) | Implements contiguous search, block splitting, compaction, buddy address arithmetic, and coalescing. |
| Comparator Header Update | [`engine/include/kernellens/core/comparator.hpp`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/engine/include/kernellens/core/comparator.hpp) | Declares `AllocatorPolicyComparison`, `AllocatorComparisonReport`, and `compare_allocator()`. |
| Comparator Implementation | [`engine/src/core/comparator.cpp`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/engine/src/core/comparator.cpp) | Implements allocator comparison evaluation, badge assignment, and JSON/CSV/Table output. |
| CLI Wiring | [`engine/cli/main.cpp`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/engine/cli/main.cpp) | Adds `--module allocator`, `--capacity`, `--compact`, and `--compare --module allocator`. |
| Allocator Unit Tests | [`tests/unit/test_allocator.cpp`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/tests/unit/test_allocator.cpp) | Tests First-Fit/Best-Fit/Worst-Fit differences, compaction, zero/overflow edge cases, and accounting invariants. |
| Buddy Allocator Unit Tests | [`tests/unit/test_buddy_allocator.cpp`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/tests/unit/test_buddy_allocator.cpp) | Tests power-of-two rounding, recursive splitting, buddy coalescing, non-buddy protection, and invariants. |
| Golden Allocator Tests | [`tests/golden/test_golden_allocator.cpp`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/tests/golden/test_golden_allocator.cpp) | Verifies classic textbook Silberschatz buddy allocation sequence and structured comparison reporting. |
| Native Build Script | [`scripts/build-native.ps1`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/scripts/build-native.ps1) | Registers Phase 9 unit and golden test source files. |

---

## 3. Mathematical Definitions & Fragmentation Accounting

### 3.1 Contiguous Allocation Policies

Given a memory capacity $C$, a list of blocks $\mathcal{B} = \{b_0, b_1, \dots, b_n\}$ such that $\sum_{i} \text{size}(b_i) = C$ and $\text{start}(b_{i+1}) = \text{start}(b_i) + \text{size}(b_i)$, and a request for $S$ bytes from process $P$:

1. **First-Fit**:
   $$\text{Select } b_i \in \mathcal{B} \quad \text{such that } \neg \text{allocated}(b_i) \land \text{size}(b_i) \ge S \quad \text{with minimum index } i$$
2. **Best-Fit**:
   $$\text{Select } b_i \in \mathcal{B} \quad \text{such that } \neg \text{allocated}(b_i) \land \text{size}(b_i) \ge S \quad \text{minimizing } (\text{size}(b_i) - S)$$
3. **Worst-Fit**:
   $$\text{Select } b_i \in \mathcal{B} \quad \text{such that } \neg \text{allocated}(b_i) \land \text{size}(b_i) \ge S \quad \text{maximizing } (\text{size}(b_i) - S)$$

### 3.2 Binary Buddy System Arithmetic

For an allocation request of $S$ bytes:
1. **Target Order**:
   $$k = \max\left(\lceil \log_2(S) \rceil, \log_2(B_{\min})\right)$$
   $$\text{Target Size} = 2^k$$
2. **Buddy Address Computation**:
   For a block of size $2^k$ at start address $A$:
   $$\text{Buddy}(A, 2^k) = A \oplus 2^k$$
3. **Coalescing Condition**:
   Two adjacent blocks $A$ and $B$ of size $2^k$ can coalesce if and only if:
   $$\neg\text{allocated}(A) \land \neg\text{allocated}(B) \land (A.\text{size} = B.\text{size} = 2^k) \land (A.\text{start} \pmod{2^{k+1}} = 0) \land (B.\text{start} = A.\text{start} + 2^k)$$
   The merged block has order $k+1$, size $2^{k+1}$, and start address $A.\text{start}$.

### 3.3 Fragmentation Metrics

1. **Internal Fragmentation ($I_{\text{frag}}$)**:
   Memory allocated to a process in excess of what was requested:
   $$I_{\text{frag}} = \sum_{b \in \mathcal{B}_{\text{alloc}}} (\text{size}(b) - \text{requested}(b))$$
   *In contiguous allocation with exact splitting, $I_{\text{frag}} = 0$. In Buddy allocation, $I_{\text{frag}} \ge 0$ due to power-of-two padding.*

2. **External Fragmentation ($E_{\text{frag}}$)**:
   Total free memory that cannot be utilized because it is broken into discrete non-contiguous blocks:
   $$E_{\text{frag}} = \text{Total Free} - \text{Largest Free Block}$$
   $$\Phi_{\text{ext}} = \begin{cases} \frac{E_{\text{frag}}}{\text{Total Free}} & \text{if Total Free} > 0 \\ 0.0 & \text{otherwise} \end{cases}$$

3. **Memory Utilization ($U$)**:
   $$U = \frac{\text{Total Allocated}}{\text{Total Capacity}}$$

---

## 4. Verification & Test Outcomes

All native C++ tests and frontend contract tests executed successfully with **zero failures**.

### 4.1 Native C++ Test Suite Execution

```text
Executing KernelLens automated test suite (build/bin/kernellens_tests.exe)...

=========================================
 Running KernelLens Automated Test Suite
=========================================
Running test: Replay_CheckpointRecording_And_BinarySearch... [PASS]
Running test: Replay_DeterminismInvariant_ZeroDiscrepancy... [PASS]
Running test: Comparator_Cpu_DeltasAndBadges... [PASS]
Running test: Comparator_Disk_SeekDistancesAndRanking... [PASS]
Running test: Comparator_Memory_OptimalLowerBound... [PASS]
Running test: Workload_DeterministicSeed_Consistency... [PASS]
Running test: Workload_Distributions_Validity... [PASS]
Running test: Workload_DiskAndMemoryPatterns... [PASS]
Running test: Workload_JsonSerialization_RoundTrip... [PASS]
Running test: Golden_Allocator_Textbook_Buddy_Sequence... [PASS]
Running test: Golden_Allocator_Comparison_Report_Structure... [PASS]
Running test: Golden_Comparison_SilberschatzConvoy_FCFS_vs_RR... [PASS]
Running test: Golden_Comparison_Disk_Textbook_FCFS_vs_SSTF... [PASS]
Running test: Golden_Disk_Textbook_FCFS_SSTF_LOOK... [PASS]
Running test: Golden_BankersAlgorithm_Silberschatz... [PASS]
Running test: Golden_RAG_DeadlockDetection... [PASS]
Running test: Golden_BeladyAnomaly_FIFO... [PASS]
Running test: Golden_TextbookComparison_FIFO_LRU_Optimal... [PASS]
Running test: Golden_ConvoyEffect_FCFS... [PASS]
Running test: Golden_ConvoyEffect_RoundRobin... [PASS]
Running test: Filesystem_DirectoryAndFileOperations... [PASS]
Running test: Journaling_CrashRecovery_RedoAndUndo... [PASS]
Running test: BuddyAllocator_Basic_Split_And_InternalFragmentation... [PASS]
Running test: BuddyAllocator_Coalescing_Recursive_Merge... [PASS]
Running test: BuddyAllocator_NonBuddy_SameSize_DoesNotMerge... [PASS]
Running test: BuddyAllocator_ExactPowerOfTwo_And_MinBlock... [PASS]
Running test: BuddyAllocator_EdgeCases_And_DoubleFree... [PASS]
Running test: BuddyAllocator_Invariants_StressSequence... [PASS]
Running test: Allocator_FirstFit_And_Coalesce... [PASS]
Running test: Allocator_ExternalFragmentationDetection... [PASS]
Running test: Allocator_FirstFit_BestFit_WorstFit_PolicyDifferences... [PASS]
Running test: Allocator_EdgeCases_Zero_And_ExactFit_And_Overflow... [PASS]
Running test: Allocator_InvalidFrees_And_DoubleFrees... [PASS]
Running test: Allocator_Compaction_Eliminates_External_Fragmentation... [PASS]
Running test: Allocator_Accounting_Invariants... [PASS]
Running test: Disk_DirectionAndBounds... [PASS]
Running test: Workload_DeterministicSeed... [PASS]
Running test: Sync_SemaphoreCounting... [PASS]
Running test: Sync_MutexOwnership... [PASS]
Running test: TLB_HitAndMiss... [PASS]
Running test: Memory_ClockSecondChance... [PASS]
Running test: Metrics_TurnaroundAndWaiting... [PASS]
Running test: Metrics_JainFairnessIndex... [PASS]
Running test: FCFS_FIFO_Order... [PASS]
Running test: SJF_ShortestBurstSelection... [PASS]
Running test: SRTF_PreemptionTrigger... [PASS]
Running test: Priority_AgingEffect... [PASS]
Running test: RoundRobin_QuantumTimeSlice... [PASS]
Running test: CFS_NiceWeights... [PASS]
Running test: Clock_InitialState... [PASS]
Running test: Clock_MonotonicAdvance... [PASS]
Running test: Clock_PriorityTieBreaking... [PASS]
-----------------------------------------
 Total: 52 | Passed: 52 | Failed: 0
=========================================

All automated tests executed successfully!
```

### 4.2 Frontend Bridge & Replay Verification

```text
> kernellens-frontend@1.0.0 test
  ALL FRONTEND BRIDGE CONTRACT TESTS PASSED (5/5)
  ALL MEMORY UI & CONTRACT TESTS PASSED (5/5)
  ALL PHASE 4 SYNC UI & CONTRACT TESTS PASSED (6/6)
  ALL PHASE 5 UI & CONTRACT TESTS PASSED (6/6)
  ALL WASM/WORKER BRIDGE & REPLAY TESTS PASSED (5/5)
Total: 27 | Passed: 27 | Failed: 0
```

---

## 5. Command-Line Interface Demonstrations

### 5.1 Multi-Policy Comparison Mode

Command:
```powershell
build/bin/kernellens.exe --compare --module allocator
```

Output:
```text
========================================================================================================================
 KernelLens Memory Allocator Comparative Analysis (Baseline: FIRST_FIT)
 Capacity: 1024 bytes | Operations: 10
========================================================================================================================
Rank  Policy        Success   Failed    Internal Frag   External Frag   Utilization   Badges
------------------------------------------------------------------------------------------------------------------------
1     FIRST_FIT     6         1         0               164             66 %          [Lowest Failures], [Lowest Internal Frag], [Highest Utilization]
2     BEST_FIT      6         1         0               164             66 %          [Lowest Failures], [Lowest Internal Frag], [Highest Utilization]
4     WORST_FIT     6         1         0               204             56 %          [Lowest Failures], [Lowest Internal Frag]
3     BUDDY         6         1         64              128             62 %          [Lowest Failures], [Lowest External Frag]
========================================================================================================================
```

### 5.2 Single Policy Execution with Post-Workload Compaction

Command:
```powershell
build/bin/kernellens.exe --module allocator --policy FIRST_FIT --compact
```

Output:
```text
========================================================
 KernelLens Dynamic Memory Allocator: FIRST_FIT
 Capacity: 1024 bytes (Compacted)
========================================================
 Total Allocated:        676 B
 Total Free:             348 B
 Allocated Blocks:       3
 Free Blocks:            1
 Largest Free Block:     348 B
 Internal Fragmentation: 0 B
 External Fragmentation: 0 B (0.0%)
 Memory Utilization:     66.0%
--------------------------------------------------------
 Memory Block Layout:
  [   0 -  120] Size:  120 B | OCCUPIED (Owner: 5, Req: 120B)
  [ 120 -  376] Size:  256 B | OCCUPIED (Owner: 4, Req: 256B)
  [ 376 -  676] Size:  300 B | OCCUPIED (Owner: 6, Req: 300B)
  [ 676 - 1024] Size:  348 B | FREE
========================================================
```

---

## 6. Limitations & Boundaries

1. **Buddy Power-of-Two Padding**:
   In the Buddy allocator, requests that are not exact powers of two necessarily incur internal fragmentation up to $\frac{\text{size}}{2} - 1$. This is intrinsic to the binary buddy tree design.
2. **Compaction Cost**:
   `ContiguousAllocator::compact()` assumes a simple linear sliding relocation model without simulating pointer rewriting latency or virtual address translation overhead.
3. **No Dynamic Pointers**:
   Block ownership is tracked symbolically via integer process IDs (`uint32_t`), not actual host memory pointers.

---

## 7. Conclusion & Next Steps

Phase 9 is verified, documented, and fully integrated. The memory subsystem now contains comprehensive models for both paging/virtual memory and dynamic contiguous/buddy allocation.

**Status:** Phase 9 is **COMPLETE**. Ready for Phase 10 implementation upon user authorization.
