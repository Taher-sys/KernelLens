# KernelLens Architecture Specification

## 1. System Overview

KernelLens is an educational operating system simulation laboratory with a strict separation of concerns:
- **Simulation Kernel**: C++17 discrete-event simulation engine with deterministic time, explicit event priorities, total state encapsulation, and metrics calculation.
- **Engine-to-UI Bridge**: Strict JSON/NDJSON schema protocol versioned at `schemaVersion: 1`. Dual execution paths (Native CLI / WebAssembly in a Web Worker).
- **Frontend Laboratory**: React + TypeScript + D3.js animated replay, scrub, and comparison workbench.

```text
                        ┌─────────────────────────────────────────┐
                        │          KernelLens Web Frontend        │
                        │       (React + TypeScript + D3.js)      │
                        └────────────────────┬────────────────────┘
                                             │
                                     Typed EngineBridge
                              (JSON Request / NDJSON Events)
                                             │
                        ┌────────────────────┴────────────────────┐
                        │        Execution Transport Layer        │
                        │   (Web Worker + WebAssembly / CLI)      │
                        └────────────────────┬────────────────────┘
                                             │
                        ┌────────────────────┴────────────────────┐
                        │          C++17 Simulation Engine        │
                        ├────────────────────┬────────────────────┤
                        │ Discrete Clock &   │ CPU Schedulers     │
                        │ Event Queue        │ Memory & Paging    │
                        │ Process Control    │ Sync & Deadlocks   │
                        │ Event Log (JSON)   │ Disk Scheduling    │
                        │ Metrics Engine     │ Filesystem & WAL   │
                        └─────────────────────────────────────────┘
```

## 2. Discrete-Event Simulation Mechanics

### Discrete Clock & Time
Time is measured exclusively in integer ticks:
```cpp
using Tick = std::int64_t;
```
Simulated time advances only when an event is popped from the priority queue. Idle periods jump directly to the next scheduled event timestamp.

### Event Priority & Tie-Breaking
When multiple events share the exact same timestamp `Tick`, race conditions and non-determinism are eliminated via a 3-tuple total ordering:
```cpp
struct EventKey {
  Tick time;
  EventPriority priority;
  SequenceNo insertion_seq;

  bool operator>(const EventKey& other) const {
    if (time != other.time) return time > other.time;
    if (priority != other.priority) return static_cast<int>(priority) > static_cast<int>(other.priority);
    return insertion_seq > other.insertion_seq;
  }
};
```

Priority Levels (lowest integer = serviced first at identical tick):
1. `High`: Hardware timer interrupts, context-switch completions, I/O device completions.
2. `Normal`: Process arrivals, newly admitted processes.
3. `Low`: Scheduler decisions, quantum expirations, yield operations.

### Determinism Invariant
Given identical inputs `(Seed, Workload, Algorithm, Parameters)`:
1. Every native execution on any standard C++17 platform produces byte-identical event logs and metric outputs.
2. Browser WebAssembly runs match native runs exactly (excluding explicit wall-clock elapsed execution benchmark fields).

## 3. Subsystem Breakdown

### 3.1 CPU Scheduling
- Schedulers implement the `IScheduler` interface:
  - `FCFS`: Non-preemptive FIFO ready queue.
  - `SJF`: Non-preemptive shortest burst first with arrival/PID tie-breaking.
  - `SRTF`: Preemptive shortest remaining time first.
  - `Priority`: Preemptive and Non-preemptive with optional dynamic aging to prevent starvation.
  - `RoundRobin`: Fixed quantum time-slicing with configurable context-switch tick penalty.
  - `MLFQ`: Multi-level priority queues with rule-based demotion and periodic priority boost.
  - `CFS-like`: Educational virtual-runtime model with nice weight proportionality.
- State Machine: `New -> Ready <-> Running -> Waiting -> Terminated`.

### 3.2 Virtual Memory & Paging
- Page replacement policies (`IPageReplacer`):
  - `FIFO`: First-in first-out frame queue.
  - `LRU`: Least recently used with access timestamps.
  - `Optimal`: Inspects future page reference string to evict page unreferenced for longest time.
  - `Clock`: Second-chance circular buffer with reference bits.
- TLB cache model with configurable entry count, hit/miss metrics, and page table walks.
- Frame allocation models: Equal, Proportional, and Fixed.
- Explicit demonstration of Belady's Anomaly for FIFO.

### 3.3 Synchronization & Deadlocks
- Logical discrete-event semaphores (Counting and Mutex).
- Resource Allocation Graph (RAG) tracking with cycle detection using Tarjan's strongly connected components algorithm.
- Banker's Algorithm for deadlock avoidance:
  - Allocation, Max, Need, and Available matrices.
  - Safety check algorithm returning safe sequences.
  - Dynamic resource request algorithm (`Grant` vs `Wait`).

### 3.4 Disk Head Scheduling
- Head position tracking across track bounds `[0, MaxTrack]`.
- Directional movement state machine (`Increasing`, `Decreasing`).
- Schedulers: `FCFS`, `SSTF`, `SCAN`, `C-SCAN`, `LOOK`, `C-LOOK`.
- Strict calculation of total seek distance including initial seek.

### 3.5 Memory Allocators & In-Memory Filesystem (Tier 2)
- Contiguous dynamic partition allocation: First-Fit, Best-Fit, Worst-Fit.
- Fragmentation tracking: Internal fragmentation (waste within blocks) and external fragmentation (unusable scattered free space).
- In-memory inode filesystem:
  - Superblock, inode table, direct and single indirect block pointers.
  - Hierarchical directory traversal, file metadata, permissions.
  - Write-Ahead Logging (WAL) journaling with crash injection points and crash-recovery demonstration.

## 4. UI Scrubbing & Replay Architecture
To provide 60 FPS scrubbing across large event traces:
- Snapshots are captured periodically every $K$ events (e.g. $K = 50$).
- Scrubbing to time $T$ finds the nearest snapshot $\le T$ and replays forwards.
- D3.js animated transitions interpolate smoothly during normal playback, while scrubbing performs deterministic instantaneous state updates.
