# KernelLens — Engine-to-Frontend Integration Contract

**Document:** `docs/frontend-handoff.md`  
**Schema Version:** `1`  
**Engine Language:** C++17 (MSYS2/UCRT64 g++ 14.2.0)  
**Frontend Stack:** React 18 + Vite + TypeScript + D3.js (v7)  
**Status:** Verified — Grounded in C++ Engine & CLI Implementation  

---

## 1. Operating Protocol & Source of Truth

In strict accordance with `AGENTS.md`:
1. **Single Source of Truth**: The C++17 simulation engine owns all operating system algorithms, events, and metrics.
2. **Zero Algorithmic Duplication**: The React frontend acts solely as an event log consumer, timeline replay controller, and D3.js visualizer. Algorithms (e.g., Round Robin quantum expiry, SSTF distance sorting, LRU eviction, Banker safety) must **NEVER** be independently reimplemented in TypeScript.
3. **Discrete Time & Total Ordering**:
   - Simulated time is strictly integer ticks (`int64_t`). Floating-point time is forbidden.
   - Simulation events are totally ordered by:
     $$\text{Ordering Key} = (\text{event\_time}, \text{event\_priority}, \text{insertion\_sequence})$$
4. **Seeded Determinism**: Given an identical integer seed (`uint64_t`), the engine produces byte-identical event logs and metric calculations.

---

## 2. Input Workload Schema (`schemaVersion: 1`)

Workloads can be loaded from static presets, generated synthetically via `WorkloadGenerator`, or supplied as custom JSON files.

### 2.1 Process Workload JSON Specification
```json
{
  "schemaVersion": 1,
  "name": "textbook-convoy",
  "processCount": 3,
  "processes": [
    {
      "pid": 1,
      "arrivalTime": 0,
      "basePriority": 0,
      "niceValue": 0,
      "bursts": [
        {"kind": "CPU", "duration": 24}
      ]
    },
    {
      "pid": 2,
      "arrivalTime": 0,
      "basePriority": 0,
      "niceValue": 0,
      "bursts": [
        {"kind": "CPU", "duration": 3}
      ]
    },
    {
      "pid": 3,
      "arrivalTime": 0,
      "basePriority": 0,
      "niceValue": 0,
      "bursts": [
        {"kind": "CPU", "duration": 3}
      ]
    }
  ]
}
```

### 2.2 Field Definitions & Constraints
- `pid` (`uint32`): Strictly positive integer ($> 0$).
- `arrivalTime` (`int64`): Simulation tick ($\ge 0$).
- `basePriority` (`int32`): Scheduling priority (standard: $0$ = normal, higher numbers = higher priority).
- `niceValue` (`int32`): CFS nice value clamped to $[-20, 19]$.
- `bursts` (`array`): Alternating sequence of `{"kind": "CPU"|"IO", "duration": N}`. Must start with a `CPU` burst. `duration` must be $\ge 1$.

---

## 3. Normalized Event Stream Schema

Every state mutation in the discrete-event simulation emits a normalized event conforming to `schemaVersion: 1`:

```json
{
  "schemaVersion": 1,
  "runId": "convoy-ROUND_ROBIN",
  "seq": 5,
  "time": 3,
  "subsystem": "cpu",
  "type": "quantum_expired",
  "pid": 1,
  "details": {
    "quantum": 3,
    "remainingBurst": 21
  }
}
```

### Event Taxonomy Across Subsystems:
| Subsystem | Event Type (`type`) | PID | Details Payload Schema |
| :--- | :--- | :--- | :--- |
| `cpu` | `process_arrived` | `int` | `{"priority": int, "initialBurst": int}` |
| `cpu` | `dispatch` | `int` | `{"policy": string, "remainingBurst": int, "quantum"?: int}` |
| `cpu` | `preempt` | `int` | `{"preemptedBy": int, "remainingBurst": int}` |
| `cpu` | `quantum_expired` | `int` | `{"quantum": int, "remainingBurst": int}` |
| `cpu` | `cpu_burst_completed` | `int` | `{"completedBurstIndex": int}` |
| `cpu` | `io_started` | `int` | `{"ioDuration": int}` |
| `cpu` | `io_completed` | `int` | `{}` |
| `cpu` | `process_terminated` | `int` | `{"turnaround": int, "waiting": int, "response": int}` |
| `memory`| `page_accessed` | `null` | `{"page": int, "frame": int, "tlbHit": bool, "fault": bool}` |
| `memory`| `page_fault` | `null` | `{"page": int, "evictedPage"?: int}` |
| `sync` | `lock_acquired` | `int` | `{"lockId": string}` |
| `sync` | `lock_blocked` | `int` | `{"lockId": string, "queueLength": int}` |
| `sync` | `deadlock_detected` | `null`| `{"cycle": [string]}` |
| `disk` | `seek_start` | `null` | `{"fromCylinder": int, "toCylinder": int, "distance": int}` |
| `disk` | `request_serviced` | `null` | `{"cylinder": int, "totalSeek": int}` |

---

## 4. Multi-Policy Comparison Contract (Phase 8)

The native C++ `ComparisonEngine` evaluates policies on equivalent inputs and emits normalized comparison objects.

### 4.1 CPU Comparison Output Schema
```json
{
  "schemaVersion": 1,
  "baselinePolicy": "FCFS",
  "policyCount": 7,
  "results": [
    {
      "policy": "SRTF",
      "rank": 1,
      "duration": 30,
      "totalEvents": 14,
      "metrics": {
        "perProcess": [
          {"pid": 1, "waitingTime": 6, "turnaroundTime": 24, "responseTime": 0, "cpuService": 24},
          {"pid": 2, "waitingTime": 0, "turnaroundTime": 3, "responseTime": 0, "cpuService": 3},
          {"pid": 3, "waitingTime": 3, "turnaroundTime": 6, "responseTime": 3, "cpuService": 3}
        ],
        "averages": {
          "waitingTime": 3.0000,
          "turnaroundTime": 11.0000,
          "responseTime": 1.0000
        },
        "throughput": 0.1000,
        "cpuUtilization": 1.0000,
        "contextSwitches": 4,
        "jainFairness": 0.5051
      },
      "deltas": [
        {
          "metric": "waitingTime",
          "baseline": 17.0000,
          "value": 3.0000,
          "delta": -14.0000,
          "percentChange": -82.3529,
          "isImprovement": true
        },
        {
          "metric": "turnaroundTime",
          "baseline": 27.0000,
          "value": 11.0000,
          "delta": -16.0000,
          "percentChange": -59.2593,
          "isImprovement": true
        }
      ],
      "badges": ["Lowest Wait", "Lowest Turnaround", "Lowest Response", "Most Fair"]
    }
  ]
}
```

### 4.2 Disk Comparison Output Schema
```json
{
  "schemaVersion": 1,
  "baselinePolicy": "FCFS",
  "initialHead": 53,
  "results": [
    {
      "policy": "SSTF",
      "rank": 1,
      "totalSeekDistance": 236,
      "serviceOrder": [65, 67, 37, 14, 98, 122, 124, 183],
      "deltas": [
        {
          "metric": "seekDistance",
          "baseline": 640.0,
          "value": 236.0,
          "delta": -404.0,
          "percentChange": -63.125,
          "isImprovement": true
        }
      ],
      "badges": ["Minimum Seek Distance"]
    }
  ]
}
```

---

## 5. Checkpoint Replay Contract (Phase 8)

The C++ engine captures snapshots every $K=50$ events. State scrubbing backward to tick $T$:
1. Finds the nearest snapshot $S$ where $S.tick \le T$.
2. In the frontend reducer, restores $S$ and replays events forward until $event.time = T$.
3. **Guarantees zero reverse mutations and identical reconstructed state.**

### Checkpoint Snapshot Schema:
```json
{
  "tick": 3,
  "seq": 5,
  "runningPid": 2,
  "contextSwitches": 2,
  "readyPids": [3, 1],
  "terminatedPids": [],
  "processes": [
    {
      "pid": 1,
      "state": "READY",
      "burstIndex": 0,
      "remainingBurst": 21,
      "cpuService": 3,
      "readyWait": 0,
      "firstRunTime": 0,
      "finishTime": -1,
      "priority": 0
    },
    {
      "pid": 2,
      "state": "RUNNING",
      "burstIndex": 0,
      "remainingBurst": 3,
      "cpuService": 0,
      "readyWait": 3,
      "firstRunTime": 3,
      "finishTime": -1,
      "priority": 0
    }
  ]
}
```

---

## 6. Native Engine CLI Reference

### 6.1 Multi-Policy Comparison
```bash
# Compare all CPU schedulers on convoy preset
./build/bin/kernellens --compare --module cpu --preset convoy

# Compare specific policies with custom baseline and JSON format
./build/bin/kernellens --compare --module cpu --policies FCFS,SJF,SRTF,ROUND_ROBIN --baseline FCFS --format json

# Compare disk head schedulers
./build/bin/kernellens --compare --module disk --format table

# Compare memory page replacers on Belady's anomaly sequence
./build/bin/kernellens --compare --module memory --preset belady --quantum 3
```

### 6.2 Deterministic Workload Generation
```bash
# Generate bimodal workload with 5 processes and save to file
./build/bin/kernellens --generate --dist bimodal --seed 42 --processes 5 --export-workload workload.json

# Execute simulation using exported workload file
./build/bin/kernellens --module cpu --policy ROUND_ROBIN --quantum 3 --workload-file workload.json
```

### 6.3 Deterministic Checkpoint Replay
```bash
# Capture checkpoints every 20 events and scrub to ticks 0, 3, 6, 9, 30
./build/bin/kernellens --replay --preset convoy --policy ROUND_ROBIN --checkpoint-interval 20 --scrub 0,3,6,9,30
```
