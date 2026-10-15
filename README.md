# KernelLens — OS-in-a-Box Simulation Laboratory

[![C++17](https://img.shields.io/badge/C%2B%2B-17-blue.svg)](https://en.wikipedia.org/wiki/C%2B%2B17)
[![CMake](https://img.shields.io/badge/CMake-3.20+-green.svg)](https://cmake.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Frontend: React+D3](https://img.shields.io/badge/Frontend-React%20%2B%20D3.js-purple.svg)](https://d3js.org/)

**KernelLens** is a deterministic, seedable operating system simulation laboratory and educational instrument designed for **Operating Systems Lab (AID20090)**. 

Unlike static hand-drawn Gantt charts or opaque real-kernel runs, KernelLens provides an observable, reproducible discrete-event simulation engine in C++17 coupled with an interactive React + TypeScript + D3.js animated frontend.

---

## Key Features

1. **Deterministic Discrete-Event Engine**:
   - Total event ordering by `(time, priority, insertion_sequence)`.
   - Seedable PRNG (`std::mt19937_64`) for 100% reproducible byte-identical execution logs.
   - Dual target execution: Native C++ CLI & in-browser WebAssembly.

2. **Algorithm Families (Tier 1 & Tier 2)**:
   - **CPU Scheduling**: FCFS, SJF (Non-preemptive), SRTF (Preemptive), Priority (Preemptive & Non-preemptive with aging), Round Robin, Multi-Level Feedback Queue (MLFQ), and CFS-like Virtual Runtime.
   - **Virtual Memory & Paging**: FIFO, LRU, Optimal (Belady's Min), Clock (Second-Chance), TLB hit/miss metrics, frame allocation policies, Belady's anomaly demo.
   - **Synchronization & Deadlocks**: Counting & Binary Semaphores, Resource Allocation Graph (RAG) cycle detector, Banker's Algorithm safe-state validation and request handling.
   - **Disk Head Scheduling**: FCFS, SSTF, SCAN, C-SCAN, LOOK, C-LOOK with exact seek distance calculation.
   - **Memory Allocator & Filesystem (Tier 2)**: Contiguous allocation (First-Fit, Best-Fit, Worst-Fit), internal/external fragmentation tracking, binary buddy allocator, in-memory inode filesystem, write-ahead journaling with crash-injection & recovery demo.
   - **IPC, Syscalls & Interrupts (Phase 11)**: UNIX-style pipes with circular buffers & EOF/broken-pipe semantics, POSIX priority message queues with typed filtering, shared memory segments with concurrent write race detection, trap 0x80 syscall dispatcher with user/kernel privilege transitions, and 256-vector IVT with nested priority preemption and CLI/STI masking.

3. **Visual & Analytical Replay**:
   - D3.js interactive animated Gantt chart with play/pause, scrub, step, and speed controls.
   - TLB & Frame visualizer.
   - Interactive SVG Resource Allocation Graph with cycle highlights.
   - Multi-policy comparison matrix with exact deltas for turnaround, waiting, response, throughput, and Jain's fairness index.

---

## Directory Layout

```text
kernellens/
├── CMakeLists.txt              # Top-level build configuration
├── CMakePresets.json           # Native & test build presets
├── AGENTS.md                   # AI agents collaboration protocol
├── CLAUDE.md                   # Command reference & constraints
├── README.md                   # Project overview and instructions
├── docs/                       # Architecture, schemas, algorithm notes, and test plans
│   ├── architecture.md
│   ├── event-schema.md
│   ├── algorithm-notes.md
│   ├── complexity.md
│   ├── test-plan.md
│   ├── report-outline.md
│   ├── demo-script.md
│   ├── risk-register.md
│   └── phase-reports/
├── engine/                     # Discrete-event C++17 simulation engine
│   ├── include/kernellens/
│   │   ├── core/
│   │   ├── cpu/
│   │   ├── memory/
│   │   ├── sync/
│   │   ├── disk/
│   │   ├── filesystem/
│   │   ├── ipc/
│   │   ├── syscall/
│   │   ├── interrupt/
│   │   ├── workload/
│   │   └── io/
│   ├── src/
│   ├── cli/                    # Reference native command line tool
│   └── wasm/                   # WebAssembly bindings
├── tests/                      # Unit, golden, property, and integration tests
├── benchmarks/                 # Asymptotic scaling and performance benchmarks
├── frontend/                   # React + TypeScript + D3.js visual interface
└── scripts/                    # Build, test, and run automation scripts
```

---

## Quickstart

### Native C++ Engine

```bash
# Build engine, test runner, and benchmarks
powershell -ExecutionPolicy Bypass -File scripts/build-native.ps1

# Run automated tests (77/77 passing)
powershell -ExecutionPolicy Bypass -File scripts/run-tests.ps1

# Run single policy simulation
./build/bin/kernellens --module cpu --policy ROUND_ROBIN --quantum 3 --preset convoy

# Phase 8: Multi-Policy Comparison Engine
./build/bin/kernellens --compare --module cpu --preset convoy
./build/bin/kernellens --compare --module disk --format table
./build/bin/kernellens --compare --module memory --preset belady --quantum 3

# Phase 8: Deterministic Workload Generation & JSON File Execution
./build/bin/kernellens --generate --dist bimodal --seed 42 --processes 5 --export-workload workload.json
./build/bin/kernellens --module cpu --policy ROUND_ROBIN --workload-file workload.json

# Phase 8: Deterministic Checkpoint Replay & Time-Travel Scrubbing (K=10)
./build/bin/kernellens --replay --preset convoy --policy ROUND_ROBIN --checkpoint-interval 10 --scrub 0,3,6,9,30

# Phase 9: Dynamic Memory Allocator, Buddy System & Compaction
./build/bin/kernellens --module allocator --policy FIRST_FIT --compact
./build/bin/kernellens --module allocator --policy BUDDY --format json
./build/bin/kernellens --compare --module allocator --capacity 1024

# Phase 10: Ext2-Style Hierarchical Filesystem & Journal Crash Recovery
./build/bin/kernellens --module filesystem
./build/bin/kernellens --module fs --fs-strategy CONTIGUOUS
./build/bin/kernellens --module fs --format json

# Phase 11: Inter-Process Communication, Syscalls & Interrupts
./build/bin/kernellens --module ipc
./build/bin/kernellens --module syscall
./build/bin/kernellens --module interrupt
./build/bin/kernellens --module ipc --format json
```

### Frontend UI

```bash
cd frontend
npm install
npm run dev
```

---

## License

MIT License. Designed for AID20090 Operating Systems Lab.
