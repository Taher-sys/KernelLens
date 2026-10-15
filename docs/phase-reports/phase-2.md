# Phase 2 Report — CPU Scheduling

**Course:** Operating Systems Lab (AID20090), Third Year CSE / AI-DS, Semester V, 2026-27
**Project:** KernelLens — Deterministic Discrete-Event OS Simulation Laboratory
**Document:** `docs/phase-reports/phase-2.md`
**Status:** Complete — All 7 CPU schedulers implemented and tested

---

## 1. Implementation Summary

Phase 2 implements the complete CPU scheduling subsystem for KernelLens, comprising seven scheduling algorithms that demonstrate core OS scheduling concepts including fairness, responsiveness, and throughput trade-offs.

### Deliverables

| Component | Path | Status |
|-----------|------|--------|
| IScheduler interface | `engine/include/kernellens/cpu/scheduler.hpp` | Complete |
| FCFS scheduler | `engine/include/kernellens/cpu/fcfs.hpp`, `engine/src/cpu/fcfs.cpp` | Complete |
| SJF scheduler | `engine/include/kernellens/cpu/sjf.hpp`, `engine/src/cpu/sjf.cpp` | Complete |
| SRTF scheduler | `engine/include/kernellens/cpu/srtf.hpp`, `engine/src/cpu/srtf.cpp` | Complete |
| Priority scheduler | `engine/include/kernellens/cpu/priority.hpp`, `engine/src/cpu/priority.cpp` | Complete |
| Round Robin scheduler | `engine/include/kernellens/cpu/round_robin.hpp`, `engine/src/cpu/round_robin.cpp` | Complete |
| MLFQ scheduler | `engine/include/kernellens/cpu/mlfq.hpp`, `engine/src/cpu/mlfq.cpp` | Complete |
| CFS-like scheduler | `engine/include/kernellens/cpu/cfs_like.hpp`, `engine/src/cpu/cfs_like.cpp` | Complete |
| Golden tests | `tests/golden/test_golden_cpu.cpp` | Complete |
| Unit tests | `tests/unit/test_schedulers.cpp` | Complete |

---

## 2. IScheduler Interface

All schedulers implement the `IScheduler` interface defined in `engine/include/kernellens/cpu/scheduler.hpp`:

```cpp
class IScheduler {
public:
  virtual ~IScheduler() = default;

  virtual std::string name() const = 0;
  virtual void on_ready(ProcessId pid, Tick now, const SchedulerContext& ctx) = 0;
  virtual std::optional<ProcessId> select_next(const SchedulerContext& ctx) = 0;
  virtual bool should_preempt(const SchedulerContext& ctx) = 0;
  virtual std::optional<Tick> time_slice(ProcessId pid, const SchedulerContext& ctx) const = 0;
  virtual void on_dispatch(ProcessId pid, Tick now, const SchedulerContext& ctx) = 0;
  virtual void on_quantum_expired(ProcessId pid, Tick now, const SchedulerContext& ctx) = 0;
  virtual void on_cpu_burst_completed(ProcessId pid, Tick now, const SchedulerContext& ctx) = 0;
  virtual void reset() = 0;
};
```

The `SchedulerContext` struct provides scheduler access to current simulation state:
- `now`: Current simulation tick
- `running_pid`: Currently running process (if any)
- `processes`: Vector of all process runtime states
- `ready_pids`: Vector of process IDs in ready state

---

## 3. Scheduler Implementations

### 3.1 First-Come First-Served (FCFS)

**File:** `engine/src/cpu/fcfs.cpp`

- **Type:** Non-preemptive
- **Data structure:** FIFO queue (`std::deque<ProcessId>`)
- **Selection:** `select_next()` returns front of queue
- **Preemption:** Never preempts (`should_preempt()` always returns false)
- **Time slice:** No limit (returns `std::nullopt`)

**Behavior:** Processes are scheduled in arrival order. The convoy effect is demonstrable when a long process blocks subsequent short processes.

### 3.2 Shortest Job First (SJF)

**File:** `engine/src/cpu/sjf.cpp`

- **Type:** Non-preemptive
- **Data structure:** Priority queue ordered by remaining burst time
- **Selection:** `select_next()` returns process with shortest remaining burst
- **Tie-breaking:** Earlier arrival time, then lower PID
- **Preemption:** Never preempts

**Behavior:** Minimizes average waiting time for batch workloads where burst times are known in advance.

### 3.3 Shortest Remaining Time First (SRTF)

**File:** `engine/src/cpu/srtf.cpp`

- **Type:** Preemptive
- **Data structure:** Priority queue ordered by remaining burst time
- **Selection:** Same as SJF
- **Preemption:** `should_preempt()` returns true if a newly arrived process has shorter remaining time than the running process

**Behavior:** Preempts running process when a shorter job arrives. Provides optimal average waiting time among all scheduling algorithms.

### 3.4 Priority Scheduler

**File:** `engine/src/cpu/priority.cpp`

- **Type:** Configurable (preemptive or non-preemptive)
- **Data structure:** Priority queue ordered by effective priority (lower integer = higher priority)
- **Aging:** Optional aging to prevent starvation

**Aging Formula:**
```
effective_priority(t) = base_priority - floor((t - t_ready) / aging_interval)
```

Where:
- `t` = current tick
- `t_ready` = tick when process entered ready state
- `aging_interval` = configurable aging tick interval

**Configuration:**
- `preemptive`: Boolean flag
- `aging_interval`: Tick interval for priority boost (0 = disabled)

**Test verification:** `Priority_AgingEffect` test confirms that a process with base priority 5 waiting 50 ticks with interval 10 achieves effective priority 0.

### 3.5 Round Robin (RR)

**File:** `engine/src/cpu/round_robin.cpp`

- **Type:** Preemptive (time-sliced)
- **Data structure:** Circular FIFO queue
- **Time slice:** Configurable quantum (default: 3 ticks)
- **Preemption:** On quantum expiration

**Behavior:** Each process receives a fixed time slice. When quantum expires, process is moved to back of ready queue.

**Golden test verification:**
- Convoy workload (P1=24, P2=3, P3=3) with quantum=3
- P2 finishes at t=6 (wait=3), P3 at t=9 (wait=6), P1 at t=30 (wait=6)
- Average waiting: 5.0 vs 17.0 for FCFS — dramatic improvement

### 3.6 Multi-Level Feedback Queue (MLFQ)

**File:** `engine/src/cpu/mlfq.cpp`

- **Type:** Preemptive with priority boost
- **Data structure:** Multiple priority queues (K levels)
- **Configuration:**
  - `num_levels`: Number of priority queues
  - `quantum_base`: Base time quantum for highest priority
  - `boost_interval`: Ticks between priority boosts

**Rules:**
1. New processes enter highest priority queue
2. Process using full quantum is demoted to lower priority
3. Priority boost moves all processes to highest priority queue every `boost_interval` ticks

### 3.7 CFS-like Scheduler (Educational)

**File:** `engine/src/cpu/cfs_like.cpp`

- **Type:** Preemptive (vruntime-based)
- **Data structure:** Red-black tree ordered by vruntime (simulated with `std::map`)

**Virtual Runtime Calculation:**
```
vruntime += delta_exec * (1024 / weight)
```

Where `weight` is determined by nice value using Linux kernel's weight table.

**Nice-to-Weight Mapping:**
- nice=0 → weight=1024
- nice=-20 → higher weight (higher priority)
- nice=19 → lower weight (lower priority)

**Behavior:** Process with lowest vruntime is always selected next. This is a simplified educational model, not a full Linux CFS implementation.

---

## 4. Metrics

All schedulers contribute to the following metrics computed by `engine/src/core/metrics.cpp`:

| Metric | Formula |
|--------|---------|
| Turnaround time | `finish_time - arrival_time` |
| Waiting time | Accumulated ticks in ready state |
| Response time | `first_run_time - arrival_time` |
| CPU utilization | `(total_cpu_ticks / total_duration) * 100` |
| Throughput | `num_completed / total_duration` |
| Jain's Fairness Index | `(Σxᵢ)² / (n × Σxᵢ²)` |

---

## 5. Test Results

### Golden Tests (`tests/golden/test_golden_cpu.cpp`)

| Test | Description | Verification | Status |
|------|-------------|--------------|--------|
| `Golden_ConvoyEffect_FCFS` | Convoy workload with FCFS | avg_wait=17.0, avg_turnaround=27.0 | PASS |
| `Golden_ConvoyEffect_RoundRobin` | Convoy workload with RR(q=3) | avg_wait=5.0, P2 finish=6, P3 finish=9 | PASS |

### Unit Tests (`tests/unit/test_schedulers.cpp`)

| Test | Description | Status |
|------|-------------|--------|
| `FCFS_FIFO_Order` | FIFO ordering verification | PASS |
| `SJF_ShortestBurstSelection` | Shortest burst selection | PASS |
| `SRTF_PreemptionTrigger` | Preemption when shorter arrives | PASS |
| `Priority_AgingEffect` | Aging formula verification | PASS |
| `RoundRobin_QuantumTimeSlice` | Quantum time slice returned | PASS |
| `CFS_NiceWeights` | Nice-to-weight conversion | PASS |

### Execution Output

```
Running test: Golden_ConvoyEffect_FCFS...
 [PASS] Golden_ConvoyEffect_FCFS
Running test: Golden_ConvoyEffect_RoundRobin...
 [PASS] Golden_ConvoyEffect_RoundRobin
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
```

---

## 6. CLI Integration

The `kernellens` CLI supports all schedulers:

```
.\build\bin\kernellens.exe --module cpu --policy FCFS --preset convoy
.\build\bin\kernellens.exe --module cpu --policy ROUND_ROBIN --preset convoy --quantum 3
.\build\bin\kernellens.exe --module cpu --policy PRIORITY --preset starvation --preemptive --aging 10
```

Output formats: `summary`, `json`, `ndjson`

---

## 7. Complexity Analysis

| Scheduler | `select_next()` | `on_ready()` | Space |
|-----------|-----------------|--------------|-------|
| FCFS | O(1) | O(1) | O(n) |
| SJF | O(log n) | O(log n) | O(n) |
| SRTF | O(log n) | O(log n) | O(n) |
| Priority | O(log n) | O(log n) | O(n) |
| Round Robin | O(1) | O(1) | O(n) |
| MLFQ | O(1) | O(1) | O(n) |
| CFS-like | O(log n) | O(log n) | O(n) |

---

## 8. Acceptance Criteria Verification

| Criterion | Requirement | Status |
|-----------|-------------|--------|
| 7 schedulers implemented | FCFS, SJF, SRTF, Priority, RR, MLFQ, CFS-like | ✓ Complete |
| Deterministic tie-breaking | (time, priority, insertion_seq) ordering | ✓ Verified |
| Preemption support | SRTF, Priority, RR, MLFQ, CFS | ✓ Implemented |
| Aging support | Priority scheduler with configurable interval | ✓ Tested |
| Convoy effect demonstration | FCFS vs RR comparison | ✓ Golden test |
| Metrics computation | Turnaround, waiting, response, fairness | ✓ Verified |
| JSON event emission | schemaVersion=1 compliant | ✓ Verified |

---

## 9. Dependencies

- Phase 1: Core clock, event queue, event log, process runtime
- Phase 0: Architecture specification, event schema, test plan

---

## 10. Frontend Bridge Contract & UI Integration

As specified in Phase 2 frontend integration requirements, the C++ engine results are bridged cleanly into the React/TypeScript frontend without duplicating or reimplementing any scheduling algorithms in TypeScript.

### 10.1 Bridge Schema & Contract (`frontend/src/bridge/schema.ts`)
- **Schema Version:** `schemaVersion: 1` compliant with `docs/event-schema.md`.
- **Typed Dispatch Contract:**
  - `IEngineBridge.run(request: SimulationRequest): Promise<SimulationResponse>`
  - `SimulationRequest`: Contains `schemaVersion`, `runId`, `seed`, `module: 'cpu'`, `policy` (with `name`, `quantum`), and `workload` (`processes: ProcessSpec[]`).
  - `SimulationResponse`: Contains `schemaVersion: 1`, `status: 'completed' | 'error'`, `simulatedDuration`, `events: SimEvent[]`, and `metrics: SimulationMetrics`.
- **Policy Enforcement:** Rejects unknown policies with an explicit error:
  `Unsupported CPU scheduling policy: "<name>". Supported policies are: FCFS, SJF, SRTF, PRIORITY, ROUND_ROBIN, MLFQ, CFS_LIKE`.

### 10.2 Mock-Free Run Controls (`frontend/src/features/CpuReplay.tsx`)
- **Zero Fakes / Zero Mocks:** Controls invoke `defaultEngineBridge.run(request)` directly with actual workload and policy configurations.
- **Empty State:** Explicitly renders `"No simulation is loaded."` when unloaded.
- **Controls Available:**
  - Workload presets: Convoy Effect (Silberschatz), SJF Benchmark, Starvation Demo, Interactive Mixed (I/O), and Unloaded (Empty).
  - All 7 CPU policies selectable (`FCFS`, `SJF`, `SRTF`, `PRIORITY`, `ROUND_ROBIN`, `MLFQ`, `CFS_LIKE`).
  - Quantum input for time-sliced policies (`ROUND_ROBIN`, `MLFQ`).
  - Preemption toggle and aging interval for `PRIORITY`.
  - Context switch cost input.
  - Explicit "Run Simulation" trigger button with execution state feedback.

### 10.3 Temporary Readable Event Table
- **Raw Event Stream:** Directly renders the engine's event log ordered by `(time, priority, seq)`.
- **Columns:** `# Seq`, `Tick` (`time`), `Subsystem` (`cpu`), `Type` (badge-coded: dispatch, quantum_expired, preempt, terminated, etc.), `PID`, and formatted `Details`.
- **Interactive Scrubber Sync:** Rows matching `time === currentTick` are highlighted with a glowing border and background tint; past events (`time <= currentTick`) have full contrast; future events are dimmed.
- **Event Filter & Search:** Real-time filtering by event type and free-text search across PID and JSON details.

### 10.4 D3 Gantt Component & Zero Invented Metrics
- D3.js Gantt chart visualizes process execution intervals on the y-axis per PID against discrete ticks on the x-axis, with a scrubber needle tied to `currentTick`.
- **Strict Metric Integrity:** The UI strictly displays metrics emitted by the engine's canonical `SimulationMetrics` struct:
  - Average Waiting Time (`simResponse.metrics.averages.waitingTime`)
  - Average Turnaround Time (`simResponse.metrics.averages.turnaroundTime`)
  - Average Response Time (`simResponse.metrics.averages.responseTime`)
  - CPU Utilization (`simResponse.metrics.cpuUtilization * 100%`)
  - Context Switches (`simResponse.metrics.contextSwitches`)
  - Throughput (`simResponse.metrics.throughput`)
  - Jain's Fairness Index (`simResponse.metrics.jainFairness`)
  - Per-process Breakdown (`waitingTime`, `turnaroundTime`, `responseTime`, `cpuService`)
- No invented or fabricated system metrics are displayed.

### 10.5 Contract Test Verification (`frontend/src/tests/contract.test.ts`)
Run command: `npm run test:contract` (via `tsx src/tests/contract.test.ts`):
```text
========================================================
   Running KernelLens Frontend Bridge Contract Tests    
========================================================

Test 1: Validating FCFS SimulationResponse shape...
 [PASS] FCFS SimulationResponse shape verified.

Test 2: Validating Round Robin Convoy Effect contract...
 [PASS] Round Robin Convoy metrics contract verified.

Test 3: Validating error handling for unsupported policy names...
 [PASS] Unsupported policy error correctly rejected.

Test 4: Validating error handling for null/empty request...
 [PASS] Null request correctly rejected.

Test 5: Verifying all 7 supported CPU policies execute...
 [PASS] All 7 CPU policies verified.

========================================================
   ALL FRONTEND BRIDGE CONTRACT TESTS PASSED (5/5)      
========================================================
```

### 10.6 Frontend Production Build Verification
Run command: `npm run build` (`tsc && vite build`):
```text
> kernellens-frontend@1.0.0 build
> tsc && vite build

vite v5.4.21 building for production...
transforming...
✓ 2169 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   1.15 kB │ gzip:  0.66 kB
dist/assets/index-RM7JdNHP.css    4.69 kB │ gzip:  1.74 kB
dist/assets/index-BmlMDe_3.js   308.69 kB │ gzip: 89.57 kB
✓ built in 2.65s
```

---

## 11. Next Phase

Phase 3: Virtual Memory & Paging
- Page replacement policies (FIFO, LRU, Optimal, Clock)
- TLB cache simulation
- Frame allocation models
- Belady's Anomaly demonstration

