# Phase 10 Report — Simulated Hierarchical Inode Filesystem, Allocation Strategies, Permissions & Crash-Consistent Journaling

**Course:** Operating Systems Lab (AID20090), Third Year CSE / AI-DS, Semester V, 2026–27  
**Project:** KernelLens — Deterministic Discrete-Event OS Simulation Laboratory  
**Document:** `docs/phase-reports/phase-10.md`  
**Status:** Complete — Ext2-style hierarchical inode tree, Contiguous/Linked/Indexed allocation strategies, POSIX octal permission model, capacity limits/exhaustion handling, Write-Ahead Logging (WAL) journaling with crash injection, and recovery verified (60/60 native tests passing).

---

## 1. Executive Summary

Phase 10 completes the storage and persistence subsystem of KernelLens by delivering an educational, deterministic, in-memory simulated file system (`InodeFileSystem`). While Phase 4 modeled low-level disk cylinder scheduling (FCFS, SSTF, SCAN, C-SCAN, LOOK, C-LOOK), Phase 10 provides the operating system's logical file abstraction.

Phase 10 delivers:
1. **Ext2-Style Hierarchical Inode Model (`Inode`)**:
   - Discrete inode records containing file size, type (`is_directory`), timestamps (`ctime`, `mtime`), ownership (`uid`, `gid`), reference count (`link_count`), and octal permissions.
   - Support for direct blocks (up to 8 blocks) and single indirect block pointers pointing to secondary index blocks.
2. **Three Classic File Allocation Strategies**:
   - **Contiguous Allocation**: Files occupy a continuous span of disk block IDs $[S, S + K - 1]$. Provides maximal sequential read throughput, but exhibits external fragmentation and allocation failure when no contiguous hole fits.
   - **Linked Allocation**: Blocks are allocated anywhere in the free pool and linked sequentially via `block_chain`. Eliminates external fragmentation; models pointer overhead and sequential traversal cost.
   - **Indexed Allocation**: Direct block pointers and an indirect index block pointing to data blocks. Models Ext2-style balanced $O(1)$ direct access and single indirect pointer tables.
3. **POSIX Permission Model & Validation**:
   - Traditional UNIX octal permission bits (`rwxrwxrwx`: owner, group, others).
   - User context evaluation (`UserContext`: `uid`, `gid`, `is_root`).
   - Root privilege override (UID 0 bypasses standard permission checks).
   - Traversal execution checks: accessing any path `/dir1/dir2/file` requires `Execute` (`01`) permission on all ancestor directories.
   - Directory modification checks: file creation and deletion require `Write` (`02`) permission on the parent directory.
4. **Capacity & Exhaustion Accounting**:
   - Block pool with fixed block size (default 512 bytes) and configurable disk capacity (default 128 blocks).
   - Atomic allocation failure: when free blocks are insufficient or no contiguous hole exists, operations fail cleanly without leaking partial allocations.
5. **Deterministic Write-Ahead Logging & Crash Recovery (`JournalingFileSystem`)**:
   - Transaction lifecycle: `Active` $\to$ `Committed` $\to$ `Checkpoint/Flushed`.
   - Controlled crash injection points:
     - `PreCommit`: Crash before commit record is appended to journal $\to$ transaction discarded/aborted during recovery.
     - `PostCommitPreApply`: Crash after commit record is logged but before filesystem disk blocks are flushed $\to$ transaction redone/rolled forward during recovery.
6. **Deterministic CLI & Schema-Compliant JSON Output**:
   - `--module filesystem` (or `--module fs`) with tree view, metrics, and recovery reporting.
   - Emits structured JSON adhering strictly to `schemaVersion: 1`.

---

## 2. Core Architectural Deliverables

| Deliverable | Path | Description |
| :--- | :--- | :--- |
| Inode & Metadata Header | [`engine/include/kernellens/filesystem/inode.hpp`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/engine/include/kernellens/filesystem/inode.hpp) | Declares `Inode`, `DirectoryEntry`, `FileAllocationStrategy`, `FileAccessMode`, and `UserContext`. |
| Filesystem Header | [`engine/include/kernellens/filesystem/filesystem.hpp`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/engine/include/kernellens/filesystem/filesystem.hpp) | Declares `InodeFileSystem`, `FileSystemMetrics`, allocation strategy helpers, and tree printer. |
| Filesystem Implementation | [`engine/src/filesystem/filesystem.cpp`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/engine/src/filesystem/filesystem.cpp) | Implements contiguous/linked/indexed block allocation, path resolution, permission validation, and directory operations. |
| Journal Header | [`engine/include/kernellens/filesystem/journal.hpp`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/engine/include/kernellens/filesystem/journal.hpp) | Declares `JournalingFileSystem`, `JournalRecord`, `CrashPoint`, and `RecoveryReport`. |
| Journal Implementation | [`engine/src/filesystem/journal.cpp`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/engine/src/filesystem/journal.cpp) | Implements WAL transaction logging, crash injection, and redo/undo recovery logic. |
| CLI Integration | [`engine/cli/main.cpp`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/engine/cli/main.cpp) | Adds `--module filesystem`, `--fs-strategy`, and `--fs-capacity` command-line options. |
| Filesystem Unit Tests | [`tests/unit/test_filesystem.cpp`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/tests/unit/test_filesystem.cpp) | Comprehensive tests for allocation strategies, exhaustion, POSIX permissions, directory constraints, and crash recovery. |
| Golden Filesystem Tests | [`tests/golden/test_golden_filesystem.cpp`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/tests/golden/test_golden_filesystem.cpp) | Golden fixtures for Ext2 tree structure, multi-level indirect indexed allocation, and journal recovery schema. |
| Native Build Script | [`scripts/build-native.ps1`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/scripts/build-native.ps1) | Registers Phase 10 unit and golden test files. |

---

## 3. Allocation Strategy Models & Comparative Trade-offs

| Strategy | Allocation Mechanism | Internal Metadata | Advantages | Disadvantages |
| :--- | :--- | :--- | :--- | :--- |
| **Contiguous** | Continuous run $[S, S + K - 1]$ of free block IDs | `direct_blocks = [S, S+1, ...]` | $O(1)$ random access, optimal disk seek efficiency | Suffers from external fragmentation; file expansion requires relocation |
| **Linked** | Non-contiguous arbitrary blocks from pool | `block_chain = [B_0, B_1, ...]` | Zero external fragmentation; trivial file growth | $O(N)$ sequential seek traversal; no direct random access |
| **Indexed** | Direct pointers (up to 8) + 1 single indirect index block | `direct_blocks[0..7]`, `indirect_block`, `indirect_blocks` | $O(1)$ direct access; structured indirect expansion | 1 block overhead for indirect table; index block capacity bound |

---

## 4. Verification & Test Outcomes

All native C++ tests and frontend contract tests executed successfully with **zero failures**.

### 4.1 Native C++ Test Suite (60/60 Passed)

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
Running test: Golden_Filesystem_Ext2_Structure_And_Json... [PASS]
Running test: Golden_Filesystem_MultiLevel_Indirect_Indexed_Allocation... [PASS]
Running test: Golden_Journal_CrashRecovery_Report_Schema... [PASS]
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
Running test: Filesystem_AllocationStrategies_Contiguous_Linked_Indexed... [PASS]
Running test: Filesystem_StorageExhaustion_And_Rollback... [PASS]
Running test: Filesystem_Permissions_POSIX_Model... [PASS]
Running test: Filesystem_DirectoryConstraints_And_Deletion... [PASS]
Running test: Journaling_CrashRecovery_RedoAndUndo... [PASS]
Running test: Journaling_ComplexCrashScenario_MultipleTransactions... [PASS]
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
 Total: 60 | Passed: 60 | Failed: 0
=========================================

All automated tests executed successfully!
```

### 4.2 Frontend Verification (27/27 Passed)

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

## 5. Command-Line Interface Demonstration

### 5.1 Hierarchical Filesystem Summary & Tree View

Command:
```powershell
build/bin/kernellens.exe --module filesystem
```

Output:
```text
========================================================
 KernelLens Hierarchical Inode Filesystem (Phase 10)
 Block Size: 512 B | Max Blocks: 128
 Default Allocation Strategy: INDEXED
========================================================
 Total Inodes:     9
 Directories:      5
 Files:            4
 Data Stored:      118 B
 Used Blocks:      4 / 128
 Free Blocks:      124
--------------------------------------------------------
 Journal Crash Recovery Report:
  Recovery complete. Redone committed transactions: 2, Discarded uncommitted transactions: 1
--------------------------------------------------------
 Directory Hierarchy:
[DIR]  // (ino 1, 755)
  [DIR]  bin/ (ino 2, 755)
    [FILE] sh (26 B, ino 6, CONTIGUOUS)
  [DIR]  home/ (ino 3, 755)
  [DIR]  var/ (ino 4, 755)
    [DIR]  log/ (ino 5, 755)
      [FILE] syslog (50 B, ino 7, LINKED)
      [FILE] audit.log (18 B, ino 8, INDEXED)
      [FILE] recovered.log (24 B, ino 9, INDEXED)
========================================================
```

### 5.2 Structured Machine-Readable JSON Output (`schemaVersion: 1`)

Command:
```powershell
build/bin/kernellens.exe --module fs --format json
```

Key Output Sections:
```json
{
  "events": [
    {"schemaVersion":1,"runId":"fs-simulation","seq":0,"time":0,"subsystem":"filesystem","type":"directory_created","pid":null,"details":{"path":"/bin","inumber":2,"perms":493}},
    {"schemaVersion":1,"runId":"fs-simulation","seq":4,"time":0,"subsystem":"filesystem","type":"file_created","pid":null,"details":{"path":"/bin/sh","inumber":6,"strategy":"CONTIGUOUS","size":26,"blocks":1}},
    {"schemaVersion":1,"runId":"fs-simulation","seq":6,"time":0,"subsystem":"filesystem","type":"fs_transaction_started","pid":null,"details":{"txId":100,"op":"CREATE_FILE","path":"/var/log/audit.log"}},
    {"schemaVersion":1,"runId":"fs-simulation","seq":7,"time":0,"subsystem":"filesystem","type":"fs_log_written","pid":null,"details":{"txId":100,"status":"COMMITTED"}},
    {"schemaVersion":1,"runId":"fs-simulation","seq":10,"time":0,"subsystem":"filesystem","type":"fs_crash_injected","pid":null,"details":{"txId":101,"point":"PRE_COMMIT"}},
    {"schemaVersion":1,"runId":"fs-simulation","seq":12,"time":0,"subsystem":"filesystem","type":"fs_crash_injected","pid":null,"details":{"txId":102,"point":"POST_COMMIT_PRE_APPLY"}},
    {"schemaVersion":1,"runId":"fs-simulation","seq":14,"time":0,"subsystem":"filesystem","type":"fs_recovery_completed","pid":null,"details":{"redone":2,"discarded":1,"status":"RECOVERED"}}
  ],
  "metrics": {
    "blockSize": 512,
    "totalBlocks": 128,
    "usedBlocks": 4,
    "freeBlocks": 124,
    "totalInodes": 9,
    "directoryCount": 5,
    "fileCount": 4,
    "totalDataBytes": 118
  },
  "recovery": {
    "redoneTransactions": 2,
    "discardedTransactions": 1,
    "explanation": "Recovery complete. Redone committed transactions: 2, Discarded uncommitted transactions: 1",
    "redoneTxIds": [100, 102],
    "discardedTxIds": [101]
  }
}
```

---

## 6. Limitations & Educational Boundaries

1. **In-Memory Block Store**:
   Block data is stored in memory via simulated string buffers (`std::map<uint32_t, std::string>`). It does not write to the host disk or risk host data corruption.
2. **Single-Level Indirect Pointer Table**:
   Indexed allocation models up to 8 direct blocks plus 1 single indirect pointer block. Double and triple indirect tables (Ext3/4 style) are deferred to advanced extensions.
3. **Journal Modes**:
   The simulator models metadata-and-data WAL (Journaling mode). Ordered and Writeback journaling modes are not simulated.

---

## 7. Conclusion & Next Phase

Phase 10 has been verified, tested, and documented with 100% test pass rates across all native and frontend suites.

- **Phase 9:** Verified & Documented in [`docs/phase-reports/phase-9.md`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/docs/phase-reports/phase-9.md).
- **Phase 10:** Verified & Documented in [`docs/phase-reports/phase-10.md`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/docs/phase-reports/phase-10.md).
- **Roadmap:** Updated in [`docs/ROADMAP.md`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/docs/ROADMAP.md).

Per instructions: **Phase 10 is complete. Awaiting user authorization before initiating Phase 11.**
