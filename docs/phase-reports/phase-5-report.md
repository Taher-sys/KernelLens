# Phase 5 Report — Dynamic Allocators & In-Memory Filesystem (Tier 2 Committed)

**Course:** Operating Systems Lab (AID20090)  
**Project:** KernelLens  
**Phase:** 5 — Memory Allocators & In-Memory Filesystem  
**Status:** Completed & Validated (100% Tests Passing)

---

## 1. Accomplishments

1. **Dynamic Contiguous Memory Allocators**:
   - `First-Fit`, `Best-Fit`, `Worst-Fit` partition allocation policies.
   - Dynamic block splitting upon partial allocation.
   - Immediate boundary coalescing upon deallocation merging adjacent free holes.
   - Exact external fragmentation detection when an allocation request fails despite total free memory exceeding the requested byte count.

2. **In-Memory Inode Filesystem**:
   - Superblock, inode table, and data block pool with configurable block size (default: 512 bytes).
   - Inode metadata: `inumber`, `is_directory`, `size_bytes`, `permissions` (octal), `direct_blocks`, `ctime`, `mtime`.
   - Directory hierarchy traversal, file creation, reading, writing, deletion, and directory listing.

3. **Write-Ahead Logging (WAL) & Crash Recovery**:
   - Transaction logging state machine: `Active`, `Committed`, `Aborted`.
   - Crash injection at two explicit discrete points:
     - `PreCommit`: Crash before transaction commit record written to journal (transaction discarded on recovery).
     - `PostCommitPreApply`: Crash after commit record written to journal but before filesystem apply (transaction redone during recovery).
   - Proven ACID crash-recovery guarantees.

4. **Automated Verification**:
   - 28 unit and golden tests passing cleanly across all 5 completed engine phases.

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
Running test: Filesystem_DirectoryAndFileOperations...
 [PASS] Filesystem_DirectoryAndFileOperations
Running test: Journaling_CrashRecovery_RedoAndUndo...
 [PASS] Journaling_CrashRecovery_RedoAndUndo
Running test: Allocator_FirstFit_And_Coalesce...
 [PASS] Allocator_FirstFit_And_Coalesce
Running test: Allocator_ExternalFragmentationDetection...
 [PASS] Allocator_ExternalFragmentationDetection
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
 Total: 28 | Passed: 28 | Failed: 0
=========================================
```

---

## 3. Next Steps

- Proceed to **Phase 6 — Frontend Development: Animated React + Vite + TypeScript + D3.js Laboratory**.
