# Phase 2 Report — Virtual Memory & Page Replacement Engine

**Course:** Operating Systems Lab (AID20090)  
**Project:** KernelLens  
**Phase:** 2 — Virtual Memory & Page Replacement Engine  
**Status:** Completed & Validated (100% Tests Passing)

---

## 1. Accomplishments

1. **Page Replacement Policies Implemented**:
   - `FIFO`: First-in, first-out replacement tracking frame arrival order.
   - `LRU`: Least Recently Used replacement tracking accurate access timestamps.
   - `OPTIMAL`: Belady's theoretical MIN algorithm performing lookahead over future references to maximize the time to next reference.
   - `CLOCK`: Second-chance circular buffer inspection with reference bits.

2. **TLB & Translation Cache Modeling**:
   - Multi-entry associative TLB with configurable capacity (default: 4 entries).
   - Fast $O(1)$ TLB hit evaluation bypassing frame search and avoiding page fault generation.
   - LRU eviction of TLB entries and automatic invalidation upon frame eviction.

3. **Paging System & Event Sourcing**:
   - Emits structured v1 events: `page_access`, `tlb_hit`, `tlb_miss`, `page_fault`, `frame_evicted`, and `frame_loaded`.
   - Comprehensive metrics: total accesses, page faults, fault rate, TLB hits/misses, and TLB hit rate.

4. **Golden Textbook Scenarios Validated**:
   - **Belady’s Anomaly Proven**:
     - Tested on sequence: `[1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5]`.
     - With 3 physical frames: 9 page faults.
     - With 4 physical frames: 10 page faults.
     - Confirms anomaly where allocating additional memory increases page faults under FIFO.
   - **Silberschatz 20-Reference Benchmark**:
     - Reference string: `7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2, 1, 2, 0, 1, 7, 0, 1` with 3 frames:
     - FIFO: 15 page faults.
     - LRU: 12 page faults.
     - Optimal: 9 page faults.
     - Strict hierarchy holds: $\text{Optimal} \le \text{LRU} \le \text{FIFO}$.

5. **CLI Integration**:
   - Command `./build/bin/kernellens --module memory --preset belady --policy FIFO --quantum 3` and `--quantum 4` executes and outputs formatted summary or full JSON event streams.

---

## 2. Test Execution Output

```text
=========================================
 Running KernelLens Automated Test Suite
=========================================
Running test: Golden_BeladyAnomaly_FIFO...
 [PASS] Golden_BeladyAnomaly_FIFO
Running test: Golden_TextbookComparison_FIFO_LRU_Optimal...
 [PASS] Golden_TextbookComparison_FIFO_LRU_Optimal
Running test: Golden_ConvoyEffect_FCFS...
 [PASS] Golden_ConvoyEffect_FCFS
Running test: Golden_ConvoyEffect_RoundRobin...
 [PASS] Golden_ConvoyEffect_RoundRobin
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
 Total: 17 | Passed: 17 | Failed: 0
=========================================
```

---

## 3. Next Steps

- Proceed to **Phase 3 — Synchronization & Deadlocks** (Semaphores, Mutexes, RAG cycle detector, Banker's Algorithm safe-state analysis and request evaluation).
