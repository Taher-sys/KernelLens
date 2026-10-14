# KernelLens Event Schema Specification (Version 1)

All simulation state mutations are emitted as structured events conforming to `schemaVersion: 1`.

## 1. Top-Level Event Envelope

```json
{
  "schemaVersion": 1,
  "runId": "seed-42-cpu-rr",
  "seq": 17,
  "time": 5,
  "subsystem": "cpu",
  "type": "dispatch",
  "pid": 3,
  "details": {
    "fromState": "READY",
    "toState": "RUNNING",
    "remainingBurst": 4,
    "quantum": 3,
    "policy": "ROUND_ROBIN"
  }
}
```

### Envelope Fields
| Field | Type | Description |
|---|---|---|
| `schemaVersion` | `integer` | Schema version (always 1). |
| `runId` | `string` | Unique identifier for the simulation run. |
| `seq` | `integer` | Strictly monotonic 0-based sequence counter. |
| `time` | `integer` | Simulation tick (`int64_t`). Never decreases. |
| `subsystem` | `string` | One of `cpu`, `memory`, `sync`, `disk`, `filesystem`, `system`. |
| `type` | `string` | Specific event identifier (e.g., `dispatch`, `page_fault`). |
| `pid` | `integer \| null` | Associated process ID if applicable, otherwise `null`. |
| `details` | `object` | Subsystem and event-type specific payload. |

---

## 2. Subsystem Event Catalog

### 2.1 CPU Events (`subsystem: "cpu"`)
- `process_arrived`:
  - `details`: `{"bursts": [...], "priority": 2, "nice": 0}`
- `ready_enqueued`:
  - `details`: `{"queueIndex": 0, "priority": 2}`
- `dispatch`:
  - `details`: `{"fromState": "READY", "toState": "RUNNING", "remainingBurst": 6, "quantum": 3}`
- `preempt`:
  - `details`: `{"reason": "higher_priority_arrived", "remainingBurst": 3, "newPid": 2}`
- `quantum_expired`:
  - `details`: `{"quantum": 3, "remainingBurst": 2}`
- `cpu_burst_completed`:
  - `details`: `{"burstIndex": 0, "nextKind": "IO", "ioDuration": 4}`
- `io_started`:
  - `details`: `{"duration": 4, "device": "disk0"}`
- `io_completed`:
  - `details`: `{"duration": 4}`
- `context_switch`:
  - `details`: `{"outgoingPid": 1, "incomingPid": 2, "costTicks": 1}`
- `process_terminated`:
  - `details`: `{"turnaround": 18, "waiting": 6, "response": 2}`

### 2.2 Memory Events (`subsystem: "memory"`)
- `page_access`:
  - `details`: `{"page": 4, "frame": 1, "isWrite": false}`
- `tlb_hit`:
  - `details`: `{"page": 4, "frame": 1}`
- `tlb_miss`:
  - `details`: `{"page": 4}`
- `page_fault`:
  - `details`: `{"page": 4, "freeFramesAvailable": 0}`
- `frame_evicted`:
  - `details`: `{"frame": 2, "evictedPage": 1, "reason": "LRU"}`
- `frame_loaded`:
  - `details`: `{"frame": 2, "page": 4}`
- `allocation_succeeded`:
  - `details`: `{"bytes": 1024, "start": 2048, "blockId": 3, "policy": "FIRST_FIT"}`
- `allocation_failed`:
  - `details`: `{"bytes": 4096, "totalFree": 3000, "reason": "external_fragmentation"}`

### 2.3 Synchronization & Deadlock Events (`subsystem: "sync"`)
- `semaphore_wait`:
  - `details`: `{"semId": "mutex", "valueBefore": 1, "valueAfter": 0, "blocked": false}`
- `semaphore_signal`:
  - `details`: `{"semId": "mutex", "valueBefore": 0, "valueAfter": 1, "unblockedPid": 2}`
- `rag_edge_added`:
  - `details`: `{"from": "P1", "to": "R1", "kind": "REQUEST"}`
- `rag_edge_removed`:
  - `details`: `{"from": "R1", "to": "P1", "kind": "ASSIGNMENT"}`
- `deadlock_detected`:
  - `details`: `{"cycles": [["P1", "R1", "P2", "R2", "P1"]]}`
- `banker_request_granted`:
  - `details`: `{"request": [1, 0, 2], "safeSequence": [1, 3, 0, 2]}`
- `banker_request_denied`:
  - `details`: `{"request": [3, 3, 0], "reason": "unsafe_state"}`

### 2.4 Disk Events (`subsystem: "disk"`)
- `disk_request_added`:
  - `details`: `{"cylinder": 98}`
- `disk_seek_started`:
  - `details`: `{"fromCylinder": 53, "toCylinder": 98, "distance": 45, "direction": "UP"}`
- `disk_request_serviced`:
  - `details`: `{"cylinder": 98, "accumulatedSeekDistance": 45}`

### 2.5 Filesystem Events (`subsystem: "filesystem"`)
- `fs_transaction_started`:
  - `details`: `{"txId": 101, "operation": "CREATE_FILE", "path": "/docs/file.txt"}`
- `fs_log_written`:
  - `details`: `{"txId": 101, "record": "INODE_ALLOCATED"}`
- `fs_crash_injected`:
  - `details`: `{"txId": 101, "point": "POST_JOURNAL_PRE_COMMIT"}`
- `fs_recovery_completed`:
  - `details`: `{"action": "REPLAY", "recoveredInodes": 1}`

---

## 3. Engine-to-UI Contract

### Execution Request
```json
{
  "schemaVersion": 1,
  "runId": "cpu-rr-42",
  "seed": 42,
  "module": "cpu",
  "policy": {
    "name": "ROUND_ROBIN",
    "quantum": 3
  },
  "workload": {
    "processes": [
      {
        "pid": 1,
        "arrivalTime": 0,
        "priority": 1,
        "bursts": [{"kind": "CPU", "duration": 5}]
      }
    ]
  },
  "options": {
    "contextSwitchCost": 1,
    "emitDetailedEvents": true
  }
}
```

### Execution Response
```json
{
  "schemaVersion": 1,
  "runId": "cpu-rr-42",
  "status": "completed",
  "simulatedDuration": 24,
  "events": [...],
  "metrics": {
    "perProcess": [
      {
        "pid": 1,
        "waitingTime": 4,
        "turnaroundTime": 9,
        "responseTime": 0
      }
    ],
    "averages": {
      "waitingTime": 4.0,
      "turnaroundTime": 9.0,
      "responseTime": 0.0
    },
    "throughput": 0.111,
    "cpuUtilization": 0.889,
    "contextSwitches": 2,
    "jainFairness": 1.0
  },
  "warnings": []
}
```
