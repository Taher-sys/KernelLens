# KernelLens Academic Report Outline

**Course:** Operating Systems Lab (AID20090), Third Year CSE / AI-DS, Semester V, 2026–27  
**Project Title:** KernelLens: A Deterministic, Seedable Discrete-Event Operating System Simulation Laboratory

---

## Table of Contents

### 1. Introduction & Problem Statement
- 1.1 Educational challenges in teaching dynamic operating system algorithms.
- 1.2 Limitations of hand-drawn Gantt charts vs black-box real kernels.
- 1.3 KernelLens solution: A deterministic, seedable OS-in-a-box laboratory with interactive visual replay.
- 1.4 Project scope: Tier 1 committed algorithms vs Tier 2 extension modules.

### 2. Architecture & Design Principles
- 2.1 Discrete-Event Simulation Core: Clocks, monotonic ticks, event priorities, total ordering.
- 2.2 Event Sourcing & Normalized Version 1 Event Schema.
- 2.3 Cross-platform Engine: C++17 Native CLI and WebAssembly compilation via Emscripten.
- 2.4 Separation of Concerns: Engine as single source of truth; Frontend as pure visual consumer.
- 2.5 Time-travel scrubbing through periodic state snapshots.

### 3. Implementation of Algorithm Families
- 3.1 CPU Scheduling:
  - FCFS, SJF, SRTF, Priority (with aging), Round Robin, MLFQ, CFS-like virtual runtime.
  - Metrics formulation: turnaround, response, waiting, throughput, utilization, Jain's fairness.
- 3.2 Virtual Memory & Paging:
  - Page replacement policies: FIFO, LRU, Optimal, Clock.
  - Multi-level TLB cache simulation.
  - Belady’s Anomaly demonstration.
- 3.3 Synchronization & Deadlocks:
  - Discrete-event counting and binary semaphores.
  - Classic problems: Producer-Consumer, Readers-Writers, Dining Philosophers.
  - Resource Allocation Graph (RAG) cycle detector.
  - Banker’s safety algorithm and dynamic resource request evaluation.
- 3.4 Disk Head Scheduling:
  - FCFS, SSTF, SCAN, C-SCAN, LOOK, C-LOOK seek distance analysis.
- 3.5 Memory Allocation & Mini In-Memory Filesystem (Tier 2):
  - Dynamic partitioning: First-Fit, Best-Fit, Worst-Fit and fragmentation analysis.
  - Inode directory structure, file metadata, block allocation.
  - Write-Ahead Logging (WAL) journaling with crash injection and recovery.

### 4. Verification, Testing & Empirical Complexity
- 4.1 Automated test suite structure: Unit, Golden, Invariant, and Integration.
- 4.2 Determinism validation: Byte-identical event logs across repeated runs.
- 4.3 Theoretical vs Empirical Asymptotic Complexity Benchmarks:
  - CPU scheduling throughput scaling up to $10^5$ events.
  - Disk head scheduling seek calculation scaling.
  - Banker's algorithm matrix operations scaling.

### 5. Frontend & Visual Replay Experience
- 5.1 React + Vite + TypeScript architecture.
- 5.2 Animated D3.js Gantt chart with interactive scrubbing and timeline controls.
- 5.3 Dynamic memory frame visualizer and interactive SVG RAG graph.
- 5.4 Multi-policy side-by-side comparison matrix with delta metrics.

### 6. Team Contributions & Division of Work
- 6.1 Individual contributions across the four team members.
- 6.2 Collaborative git workflow and AI agent governance protocol.

### 7. Conclusion & Future Extensions
- 7.1 Summary of achievements.
- 7.2 Tier 3 stretch directions: Linux `/proc` trace ingestion, ML-based burst prediction, multi-core scheduling.

### 8. References & Appendices
- 8.1 Textbook references (Silberschatz, Tanenbaum, OSTEP).
- 8.2 Event Schema definitions and Golden Test fixtures.
