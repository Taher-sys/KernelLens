# Phase 11 Report — Inter-Process Communication (IPC), Syscall Pipeline & Interrupt Abstraction

**Course:** Operating Systems Lab (AID20090), Third Year CSE / AI-DS, Semester V, 2026–27  
**Project:** KernelLens — Deterministic Discrete-Event OS Simulation Laboratory  
**Document:** `docs/phase-reports/phase-11.md`  
**Status:** Complete — UNIX-style pipes with circular buffers, POSIX priority message queues, shared memory with concurrent write race detection, trap 0x80 syscall dispatcher with user/kernel privilege escalation, and 256-vector IVT with nested priority preemption and CLI/STI masking fully verified (77/77 native tests passing, 27/27 frontend tests passing).

---

## 1. Executive Summary

Phase 11 completes the kernel-process communication and hardware/software boundary abstraction layer of KernelLens. While previous phases simulated processor scheduling, virtual memory, synchronization primitives, disk head movement, dynamic memory allocators, and filesystems, Phase 11 provides the core kernel mechanics that connect running processes to each other and to the operating system kernel:

1. **UNIX-Style Circular Buffer Pipes (`Pipe`)**:
   - Bounded ring buffer implementation with capacity constraints (default 512 bytes).
   - Chunked read and write operations with wraparound indexing.
   - Reader and writer endpoint lifecycle management with reference counting.
   - Standard UNIX EOF semantics: reading from an empty pipe where writer is closed returns 0 bytes (EOF).
   - Broken pipe error handling: writing to a pipe with closed read end immediately raises `EPIPE` and generates `SIGPIPE` event.

2. **POSIX Priority Message Queues (`MessageQueue`)**:
   - Bounded message capacity and maximum payload size per message.
   - Priority-based sorted insertion ($O(N)$ or $O(\log N)$) with guaranteed FIFO tie-breaking for messages of equal priority.
   - Dual retrieval modes:
     - Priority extraction: fetches the highest priority message regardless of send order.
     - Selective typed receive: POSIX `msgrcv`-style filtering by exact `msg_type > 0`, any `msg_type == 0`, or least type `msg_type < 0`.
   - Dropped message accounting on queue full condition.

3. **Shared Memory Segment Simulator (`SharedMemorySegment`)**:
   - Simulated physical memory page backing with unique segment IDs (`ShmId`) and keys (`IPC_CREAT`).
   - Process attachment table (`ShmAttachment`) tracking virtual memory attach address, attach timestamp, and permissions (`ReadOnly` vs `ReadWrite`).
   - Permission enforcement: writes to `ReadOnly` attachments return `EACCES`.
   - Concurrent write race detector: un-synchronized concurrent writes to the same segment at the same simulation tick or without synchronization locks trigger explicit `ipc_shm_race_detected` events, while lock-protected writes proceed cleanly.
   - `IPC_RMID` semantics: segments marked for deletion are safely preserved until all processes detach.

4. **Simulated Syscall & Hardware Trap Layer (`SyscallDispatcher`)**:
   - Simulated CPU register state (`CpuRegisters`: `pc`, `sp_user`, `sp_kernel`, `r0..r7`, `psr`).
   - Privilege mode escalation: hardware trap `0x80` transitioning CPU from Ring 3 (`CpuPrivilegeMode::User`) to Ring 0 (`CpuPrivilegeMode::Kernel`).
   - Trap frame preservation: user registers and stack pointers are pushed to kernel stack.
   - Standard POSIX system call dispatching: `SYS_EXIT`, `SYS_FORK`, `SYS_READ`, `SYS_WRITE`, `SYS_OPEN`, `SYS_CLOSE`, `SYS_GETPID`, `SYS_PIPE`, `SYS_MQ_SEND`, `SYS_MQ_RECV`, `SYS_SHM_GET`, `SYS_SHM_ATTACH`, `SYS_SHM_DETACH`, `SYS_YIELD`, `SYS_SLEEP`.
   - Privilege mode restoration: execution of `sysret` / `iret` restores user registers and Ring 3 mode.

5. **Interrupt Vector Table (IVT) & Controller (`InterruptController`)**:
   - 256-vector interrupt vector table supporting Hardware IRQs, Software Traps, and Hardware Exceptions.
   - Global interrupt flag masking: `CLI` (Clear Interrupt Flag) and `STI` (Set Interrupt Flag).
   - Priority preemption and nesting: interrupts with higher hardware priority (lower numerical IPL) immediately preempt currently running lower-priority ISRs.
   - Deferred pending queue: lower-priority interrupts arriving during high-priority servicing or while interrupts are masked are placed on a priority queue and dispatched when interrupts are re-enabled or priority drops.

6. **Unified Subsystem Manager (`IpcManager`)**:
   - Coordinates pipes, message queues, and shared memory segments.
   - Emits structured telemetry events adhering strictly to `schemaVersion: 1`.

---

## 2. Core Architectural Deliverables

| Deliverable | Path | Description |
| :--- | :--- | :--- |
| Pipe Header | [`engine/include/kernellens/ipc/pipe.hpp`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/engine/include/kernellens/ipc/pipe.hpp) | Declares `Pipe`, `PipeMetrics`, and circular buffer operations. |
| Pipe Implementation | [`engine/src/ipc/pipe.cpp`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/engine/src/ipc/pipe.cpp) | Implements ring buffer chunking, EOF, broken pipe, and JSON export. |
| Message Queue Header | [`engine/include/kernellens/ipc/message_queue.hpp`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/engine/include/kernellens/ipc/message_queue.hpp) | Declares `MessageQueue`, `MqMessage`, and `MqMetrics`. |
| Message Queue Implementation | [`engine/src/ipc/message_queue.cpp`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/engine/src/ipc/message_queue.cpp) | Implements priority sorting, type filtering, and queue drop handling. |
| Shared Memory Header | [`engine/include/kernellens/ipc/shared_memory.hpp`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/engine/include/kernellens/ipc/shared_memory.hpp) | Declares `SharedMemorySegment`, `ShmAttachment`, `ShmPermission`, and `ShmMetrics`. |
| Shared Memory Implementation | [`engine/src/ipc/shared_memory.cpp`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/engine/src/ipc/shared_memory.cpp) | Implements permissions, reference counting, and race condition detection. |
| IPC Manager | [`engine/include/kernellens/ipc/ipc_manager.hpp`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/engine/include/kernellens/ipc/ipc_manager.hpp), [`engine/src/ipc/ipc_manager.cpp`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/engine/src/ipc/ipc_manager.cpp) | Manages IPC resources and computes subsystem aggregate metrics. |
| CPU Context & Registers | [`engine/include/kernellens/syscall/context.hpp`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/engine/include/kernellens/syscall/context.hpp) | Declares `CpuRegisters`, `CpuPrivilegeMode`, and `ProcessExecutionContext`. |
| Syscall Dispatcher | [`engine/include/kernellens/syscall/syscall_table.hpp`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/engine/include/kernellens/syscall/syscall_table.hpp), [`engine/src/syscall/syscall_dispatcher.cpp`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/engine/src/syscall/syscall_dispatcher.cpp) | Implements Trap 0x80 dispatcher, privilege transitions, and syscall handlers. |
| Interrupt Controller | [`engine/include/kernellens/interrupt/interrupt.hpp`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/engine/include/kernellens/interrupt/interrupt.hpp), [`engine/src/interrupt/interrupt.cpp`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/engine/src/interrupt/interrupt.cpp) | Implements 256-vector IVT, CLI/STI masking, and nested priority preemption. |
| CLI Integration | [`engine/cli/main.cpp`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/engine/cli/main.cpp) | Adds `--module ipc`, `--module syscall`, and `--module interrupt`. |
| IPC Unit Tests | [`tests/unit/test_ipc.cpp`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/tests/unit/test_ipc.cpp) | Tests circular buffer, EOF, broken pipe, priority ordering, and race detection. |
| Syscall Unit Tests | [`tests/unit/test_syscall.cpp`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/tests/unit/test_syscall.cpp) | Tests privilege transitions, register saving, and system call execution. |
| Interrupt Unit Tests | [`tests/unit/test_interrupt.cpp`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/tests/unit/test_interrupt.cpp) | Tests IVT dispatching, CLI/STI masking, and nested priority preemption. |
| Golden IPC Tests | [`tests/golden/test_golden_ipc.cpp`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/tests/golden/test_golden_ipc.cpp) | Golden byte-stream pipe validation, priority queue sequence, and schema check. |

---

## 3. Subsystem Invariants & Complexity Analysis

| Subsystem | Operation | Time Complexity | Space Complexity | Invariants Maintained |
| :--- | :--- | :--- | :--- | :--- |
| **Pipe** | `write(bytes)` | $O(M)$ | $O(C)$ | Writes cannot exceed free space; tail advances modulo capacity; write to closed reader triggers `EPIPE`. |
| **Pipe** | `read(max)` | $O(M)$ | $O(C)$ | Reads cannot exceed available bytes; head advances modulo capacity; empty read with closed writer returns EOF (0). |
| **MessageQueue** | `send(prio)` | $O(N)$ or $O(\log N)$ | $O(N \cdot M)$ | Strictly sorted by $(priority \downarrow, id \uparrow)$; messages dropped when count $\ge max\_msgs$. |
| **MessageQueue** | `receive(type)` | $O(N)$ | $O(1)$ | Highest priority first if $type=0$; exact match for $type>0$; minimum match for $type<0$. |
| **SharedMemory** | `write(offset)` | $O(M)$ | $O(S)$ | Cannot exceed segment bounds; ReadOnly generates `EACCES`; concurrent unsynchronized writes trigger race hazard. |
| **Syscall** | `invoke(trap)` | $O(1)$ | $O(D)$ | Ring 3 $\to$ Ring 0 privilege escalation; trap frame saved; return value placed in $r0$; Ring 3 restored. |
| **Interrupt** | `raise(vec)` | $O(\log P)$ | $O(P)$ | Lower numerical IPL has higher priority; preempts if $IPL_{new} < IPL_{cur}$, otherwise defers to pending queue. |

---

## 4. Verification & Test Outcomes

All native C++ tests and frontend contract tests executed successfully with **zero failures**.

### 4.1 Native C++ Test Suite (77/77 Passed)

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
Running test: Golden_IPC_UnixPipe_ProducerConsumer_ByteStream... [PASS]
Running test: Golden_IPC_MessageQueue_PriorityDelivery_Sequence... [PASS]
Running test: Golden_Syscall_PrivilegeMode_Trace_Schema... [PASS]
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
Running test: Interrupt_VectorRegistration_And_Dispatch... [PASS]
Running test: Interrupt_Masking_CLI_STI_And_DeferredQueue... [PASS]
Running test: Interrupt_PriorityPreemption_And_Nesting... [PASS]
Running test: Syscall_PrivilegeMode_Escalation_And_Restoration... [PASS]
Running test: Syscall_IPC_Dispatching_Pipes_And_Queues... [PASS]
Running test: Syscall_InvalidSyscall_And_ArgumentErrors... [PASS]
Running test: IPC_Pipe_CircularBuffer_WriteAndRead... [PASS]
Running test: IPC_Pipe_CapacityBounds_And_PartialWrite... [PASS]
Running test: IPC_Pipe_BrokenPipe_And_EOF... [PASS]
Running test: IPC_MessageQueue_PriorityOrdering_And_FIFO... [PASS]
Running test: IPC_MessageQueue_SelectiveReceive_ByType... [PASS]
Running test: IPC_MessageQueue_CapacityLimits... [PASS]
Running test: IPC_SharedMemory_Permissions_And_RaceDetection... [PASS]
Running test: IPC_Manager_UnifiedSubsystem... [PASS]
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
 Total: 77 | Passed: 77 | Failed: 0
=========================================

All automated tests executed successfully!
```

### 4.2 Frontend Verification (27/27 Passed)

```text
> kernellens-frontend@1.0.0 test
> npm run test:contract && npm run test:memory && npm run test:sync && npm run test:phase5 && npm run test:replay

ALL FRONTEND BRIDGE CONTRACT TESTS PASSED (5/5)
ALL MEMORY UI & CONTRACT TESTS PASSED (5/5)
ALL PHASE 4 SYNC UI & CONTRACT TESTS PASSED (6/6)
ALL PHASE 5 UI & CONTRACT TESTS PASSED (6/6)
ALL WASM/WORKER BRIDGE & REPLAY TESTS PASSED (5/5)
```

---

## 5. CLI Execution Demonstrations

### 5.1 Inter-Process Communication Module (`--module ipc`)

```text
========================================================
 KernelLens Inter-Process Communication (Phase 11)
 Pipe Capacity: 512 B | MQ Max Msgs: 10
========================================================
 Total Pipes:            1
 Active Pipes:           1
 Total Message Queues:   1
 Messages Queued:        2
 Shared Memory Segments: 1
 Total Shm Bytes:        1024 B
 Data Race Hazards:      1
 Total IPC Events:       23
========================================================
```

### 5.2 Syscall & Trap 0x80 Layer (`--module syscall`)

```text
========================================================
 KernelLens Syscall & Hardware Trap Layer (Phase 11)
 Execution Mode: Ring 3 User -> Ring 0 Kernel (Trap 0x80)
========================================================
 Total Invocations:      9
 Successful Calls:       8
 Rejected Calls:         1
 Kernel Ticks Spent:     23 ticks
--------------------------------------------------------
 Call Distribution:
  SYS_CLOSE          : 1
  SYS_EXIT           : 1
  SYS_GETPID         : 1
  SYS_MQ_SEND        : 1
  SYS_PIPE           : 1
  SYS_READ           : 1
  SYS_SLEEP          : 1
  SYS_WRITE          : 1
  SYS_YIELD          : 1
========================================================
```

### 5.3 Interrupt Controller Subsystem (`--module interrupt`)

```text
========================================================
 KernelLens Interrupt Vector Controller (Phase 11)
 256-Vector IVT | Priority Preemption | CLI/STI Masking
========================================================
 Total Raised:           5
 Total Handled:          5
 Masked & Deferred:      2
 Nested Preemptions:     1
 Peak Pending Queue:     2
--------------------------------------------------------
 Serviced Vector Distribution:
  IRQ0_TIMER         : 1
  IRQ14_DISK_DMA     : 2
  IRQ1_KEYBOARD      : 2
========================================================
```

---

## 6. Known Limitations & Next Steps

1. **Virtual Address Space Paging Integration**: In Phase 11, shared memory segment attachments simulate virtual memory addresses ($0x10000, 0x20000$) through metadata tables. In upcoming Phase 14, shared memory segment attachments can be mapped directly into each process's Phase 2 two-level page table hierarchy.
2. **Next Phase (Phase 12)**: **Advanced Memory Extensions (Working-Set Analysis & Thrashing Lab)**:
   - Denning's Working-Set Page Replacement Model ($\Delta$ parameter window).
   - Page Fault Frequency (PFF) dynamic frame allocation.
   - Thrashing detection and process suspension (degree of multiprogramming throttle).
   - Multicore scheduling, load balancing, and CPU affinity.
