# Phase 4 Report — Disk Scheduling & Workload Generator

**Course:** Operating Systems Lab (AID20090)  
**Project:** KernelLens  
**Phase:** 4 — Disk Scheduling & Workloads  
**Status:** Completed & Validated (100% Tests Passing)

---

## 1. Accomplishments

1. **All 6 Disk Head Scheduling Policies Implemented**:
   - `FCFS`: Strictly FIFO cylinder service.
   - `SSTF`: Shortest Seek Time First greedy local head movement.
   - `SCAN`: Elevator sweep traversing in current direction to disk boundary, then reversing.
   - `C-SCAN`: Circular SCAN sweeping in direction to boundary, then jumping directly to opposite boundary without servicing requests on return.
   - `LOOK`: Efficient sweep reversing at the outermost pending cylinder without traveling to extremes.
   - `C-LOOK`: Circular LOOK sweeping to outermost pending cylinder, then jumping directly to lowest requested cylinder.

2. **Metrics & Seek Distance Tracking**:
   - Exact mathematical seek distance calculation:
     $$\text{Total Seek} = \sum_{j=1}^m |H_j - H_{j-1}|$$
   - Emits structured v1 events (`disk_request_serviced`) with track coordinates, hop distance, and accumulated seek.

3. **Deterministic Seedable Workload Generator**:
   - Configurable generator (`WorkloadGenerator`) powered by `std::mt19937_64` PRNG.
   - Generates byte-identical process specifications, disk request sequences, and page reference strings given identical seeds. Zero usage of `std::random_device` ensuring reproducible runs.

4. **Golden Textbook Scenarios Validated**:
   - **Silberschatz 8-Request Queue Benchmark**:
     - Requests: `[98, 183, 37, 122, 14, 124, 65, 67]`, Initial head `53`, Disk size `200` cylinders (`[0, 199]`).
     - FCFS: Total seek = **640** cylinders.
     - SSTF: Total seek = **236** cylinders.
     - LOOK: Total seek = **299** cylinders.
     - Hierarchy: $\text{SSTF (236)} < \text{LOOK (299)} < \text{FCFS (640)}$.

5. **CLI Integration**:
   - `./build/bin/kernellens --module disk --policy SSTF`
   - `./build/bin/kernellens --module disk --policy LOOK`
   - Full summary and JSON event stream formatting.

---

## 2. Test Execution Output

```text
=========================================
 Running KernelLens Automated Test Suite
=========================================
Running test: Golden_Disk_Textbook_FCFS_SSTF_LOOK...
 [PASS] Golden_Disk_Textbook_FCFS_SSTF_LOOK
Running test: Golden_BankersAlgorithm_Silberschatz...
 [PASS] Golden_BankersAlgorithm_Silberschatz
Running test: Golden_RAG_DeadlockDetection...
 [PASS] Golden_RAG_DeadlockDetection
Running test: Golden_BeladyAnomaly_FIFO...
 [PASS] Golden_BeladyAnomaly_FIFO
Running test: Golden_TextbookComparison_FIFO_LRU_Optimal...
 [PASS] Golden_TextbookComparison_FIFO_LRU_Optimal
Running test: Golden_ConvoyEffect_FCFS...
 [PASS] Golden_ConvoyEffect_FCFS
Running test: Golden_ConvoyEffect_RoundRobin...
 [PASS] Golden_ConvoyEffect_RoundRobin
Running test: Disk_DirectionAndBounds...
 [PASS] Disk_DirectionAndBounds
Running test: Workload_DeterministicSeed...
 [PASS] Workload_DeterministicSeed
Running test: Sync_SemaphoreCounting...
 [PASS] Sync_SemaphoreCounting
Running test: Sync_MutexOwnership...
 [PASS] Sync_MutexOwnership
Running test: TLB_HitAndMiss...
 [PASS] TLB_HitAndMiss
Running test: Memory_ClockSecondChance...
 [PASS] Memory_ClockSecondChance
Running test: Metrics_TurnaroundAndWaiting...
 [PASS] Metrics_TurnaroundAndWaiting
Running test: Metrics_JainFairnessIndex...
 [PASS] Metrics_JainFairnessIndex
Running test: FCFS_FIFO_Order...
 [PASS] FCFS_FIFO_Order
Running test: SJF_ShortestBurstSelection...
 [PASS] SJF_ShortestBurstSelection
Running test: SRTF_PreemptionTrigger...
 [PASS] SRTF_PreemptionTrigger
Running test: Priority_AgingEffect...
 [PASS] Priority_AgingEffect
Running test: RoundRobin_QuantumTimeSlice...
 [PASS] RoundRobin_QuantumTimeSlice
Running test: CFS_NiceWeights...
 [PASS] CFS_NiceWeights
Running test: Clock_InitialState...
 [PASS] Clock_InitialState
Running test: Clock_MonotonicAdvance...
 [PASS] Clock_MonotonicAdvance
Running test: Clock_PriorityTieBreaking...
 [PASS] Clock_PriorityTieBreaking
-----------------------------------------
 Total: 24 | Passed: 24 | Failed: 0
=========================================
```

---

## 3. Next Steps

- Proceed to **Phase 5 — Dynamic Memory Allocators & In-Memory Filesystem (Tier 2 Committed)**.
