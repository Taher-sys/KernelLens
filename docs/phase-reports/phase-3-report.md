# Phase 3 Report — Synchronization & Deadlocks Laboratory

**Course:** Operating Systems Lab (AID20090)  
**Project:** KernelLens  
**Phase:** 3 — Synchronization & Deadlocks  
**Status:** Completed & Validated (100% Tests Passing)

---

## 1. Accomplishments

1. **Logical Discrete-Event Synchronization Primitives**:
   - `SimSemaphore`: Counting semaphore supporting atomic `wait(S)` and `signal(S)` with FIFO blocked process queue and event logging (`semaphore_wait`, `semaphore_signal`).
   - `SimMutex`: Binary mutual exclusion lock with ownership tracking and automated handoff upon release.

2. **Resource Allocation Graph (RAG) & Cycle Detection**:
   - Directed bipartite graph tracking Process nodes, Resource nodes (with arbitrary instance counts), Request edges ($P_i \to R_j$), and Assignment edges ($R_j \to P_i$).
   - Cycle detection via depth-first search cycle enumeration and path deduplication.
   - Emits structured `deadlock_detected` events with exact cycle chains (e.g. `["P1", "R1", "P2", "R2", "P1"]`).

3. **Banker's Algorithm for Deadlock Avoidance**:
   - State representation: Available vector $A$, Max matrix $M$, Allocation matrix $C$, and Need matrix $N = M - C$.
   - Safety check algorithm returning safe execution sequences.
   - Speculative allocation with rollback: Evaluates dynamic requests, denies requests violating maximum claim or available resources, and rejects requests leading to unsafe states.

4. **Golden Textbook Scenarios Validated**:
   - **Silberschatz 5-Process, 3-Resource Benchmark**:
     - Initial state confirmed SAFE with sequence $\langle P_1, P_3, P_4, P_0, P_2 \rangle$.
     - Request $P_1 \to [1, 0, 2]$: Speculatively evaluated and GRANTED safely.
     - Request $P_4 \to [3, 3, 0]$: Exceeds available vector, properly DENIED.
     - Request $P_0 \to [0, 2, 0]$: Leaves system in unsafe state, properly DENIED.
   - **RAG Deadlock Cycle Validation**:
     - Mutual wait dependency cycle ($P_1 \to R_1 \to P_2 \to R_2 \to P_1$) correctly flagged as DEADLOCK.
     - Resolving request edge clears deadlock state.

5. **CLI Integration**:
   - `./build/bin/kernellens --module sync --policy BANKER`
   - `./build/bin/kernellens --module sync --policy RAG`

---

## 2. Test Execution Output

```text
=========================================
 Running KernelLens Automated Test Suite
=========================================
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
 Total: 21 | Passed: 21 | Failed: 0
=========================================
```

---

## 3. Next Steps

- Proceed to **Phase 4 — Disk Scheduling & Workloads** (FCFS, SSTF, SCAN, C-SCAN, LOOK, C-LOOK, total seek distance metrics, seedable PRNG generator).
