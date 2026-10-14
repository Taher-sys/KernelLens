# Phase 1 Report — Discrete-Event Engine & CPU Scheduling

**Course:** Operating Systems Lab (AID20090)  
**Project:** KernelLens  
**Phase:** 1 — Discrete-Event Clock & CPU Scheduling Engine  
**Status:** Completed & Validated (100% Tests Passing)

---

## 1. Accomplishments

1. **Deterministic Discrete Simulation Core**:
   - `SimClock` implementing integer monotonic ticks (`int64_t`).
   - Priority event queue totally ordered by `(time, priority, insertion_sequence)` with zero floating-point non-determinism.
   - `EventLog` serializer emitting strictly sequential events conforming to `docs/event-schema.md` (v1 schema).

2. **All 7 CPU Scheduling Policies Implemented**:
   - `FCFS`: Non-preemptive FIFO ready queue with arrival tie-breaking.
   - `SJF`: Non-preemptive Shortest Job First with deterministic tie-breakers.
   - `SRTF`: Preemptive Shortest Remaining Time First with dynamic arrival preemption.
   - `Priority`: Preemptive and Non-preemptive modes with configurable starvation aging ($\alpha$).
   - `RoundRobin`: Configurable quantum time-slicing and context-switch handling.
   - `MLFQ`: Multi-level priority queues with dynamic demotion and periodic priority boost.
   - `CFS_LIKE`: Educational virtual-runtime scheduler with standard Linux nice weight mapping [-20..19].

3. **Metrics Formulation**:
   - Per-process and average turnaround, waiting, response times.
   - CPU useful utilization, throughput, and context switch counts.
   - Jain's Fairness Index over comparable process cohorts.

4. **Reference Native CLI & Workload Presets**:
   - CLI utility `kernellens.exe` supporting `--module`, `--policy`, `--preset`, `--quantum`, `--aging`, `--preemptive`, and `--format <summary|json|ndjson>`.
   - Built-in presets: `convoy`, `sjf`, `starvation`, `interactive`, `rr`, `mlfq`.

5. **Automated Verification**:
   - Complete zero-dependency C++17 test harness in `tests/test_harness.hpp`.
   - 13 automated unit and golden tests executed and verified:
     - Silberschatz convoy effect: FCFS avg wait = 17.0 vs RR avg wait = 5.0 ticks.
     - Monotonic clock advance and priority tie-breaking.
     - Aging boost and preemption triggers.
     - Jain fairness index calculation (1.0 on equal distribution, 0.5 on skewed).

---

## 2. Test Execution Output

```text
=========================================
 Running KernelLens Automated Test Suite
=========================================
 [PASS] Golden_ConvoyEffect_FCFS
 [PASS] Golden_ConvoyEffect_RoundRobin
 [PASS] Metrics_TurnaroundAndWaiting
 [PASS] Metrics_JainFairnessIndex
 [PASS] FCFS_FIFO_Order
 [PASS] SJF_ShortestBurstSelection
 [PASS] SRTF_PreemptionTrigger
 [PASS] Priority_AgingEffect
 [PASS] RoundRobin_QuantumTimeSlice
 [PASS] CFS_NiceWeights
 [PASS] Clock_InitialState
 [PASS] Clock_MonotonicAdvance
 [PASS] Clock_PriorityTieBreaking
-----------------------------------------
 Total: 13 | Passed: 13 | Failed: 0
=========================================
```

---

## 3. Next Steps

- Proceed to **Phase 2 — Virtual Memory & Page Replacement Engine** (FIFO, LRU, Optimal, Clock, TLB metrics, and Belady's Anomaly demo).
