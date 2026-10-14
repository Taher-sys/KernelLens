# Phase 0 Report — Repository Planning, Specifications & Governance

**Course:** Operating Systems Lab (AID20090), Third Year CSE / AI-DS, Semester V, 2026–27  
**Project:** KernelLens — Deterministic Discrete-Event OS Simulation Laboratory  
**Document:** `docs/phase-reports/phase-0.md`  
**Status:** Approved & Frozen for Phase 0  

---

## 1. Repository State Inspection Summary

The repository has been inspected and initialized under the single-writer protocol (`AGENTS.md`). The core development environment and prerequisites have been verified:
- **Engine Standard:** C++17 (compiled via GCC/Clang with standard flags `-std=c++17 -Wall -Wextra -O2`).
- **Build System:** CMake (3.20+) with `CMakePresets.json` and MSYS2/UCRT64 toolchain.
- **Frontend Stack:** Strictly locked to **React 18 + Vite + TypeScript + D3.js** (no CSS-only dashboards or alternative charting libraries; D3.js SVG/Canvas rendering is mandatory for animated CPU Gantt charts, page frame allocations, resource allocation graphs, and disk head movements).
- **Execution Target:** Deterministic native C++ CLI and discrete-event simulation bridge.

---

## 2. Agreement & Consistency Verification with Architecture & Event Schema

All Phase 0 specifications have been cross-checked and verified against [`docs/architecture.md`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/docs/architecture.md) and [`docs/event-schema.md`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/docs/event-schema.md):

1. **Deterministic Discrete-Time Contract:**
   - Simulated time is strictly represented as integer ticks (`int64_t`). Floating-point time is forbidden in the engine.
   - Total event ordering is strictly defined as `(event_time, event_priority, insertion_sequence)` to ensure identical outputs on identical seeds.
   - Pseudorandom generation is strictly tied to `std::mt19937_64` with seeded state; `std::random_device` is prohibited inside the simulation loop.

2. **Schema Alignment (`schemaVersion: 1`):**
   - Every state transition across all five subsystems (`cpu`, `memory`, `sync`, `disk`, `filesystem`, `system`) maps directly to normalized JSON events.
   - Wall-clock timestamps are strictly segregated to benchmark runtime metadata and excluded from simulation event streams.

3. **Single Source of Truth Principle:**
   - The C++17 engine is the sole definitive source of truth for scheduling, paging, synchronization, and seek algorithms.
   - Algorithms are never duplicated or independently re-implemented with divergent semantics in TypeScript. The frontend operates as a pure event consumer and replay visualizer.

---

## 3. Clean Project Roadmap & Explicit Phase Acceptance Criteria

| Phase | Module / Focus | Scope & Deliverables | Explicit Acceptance Criteria |
| :--- | :--- | :--- | :--- |
| **Phase 0** | **Governance & Specifications** | Architecture blueprints, event schema, algorithm notes, test plan, complexity analysis, CMake scaffolding. | All core markdown docs in `docs/` exist, adhere to schema, and compile without code implementation. |
| **Phase 1** | **Core Clock & CPU Schedulers** | `Tick` clock, priority queue, `EventLog`, 7 CPU schedulers (FCFS, SJF, SRTF, Priority w/ aging, RR, MLFQ, CFS-like vruntime). | Golden Silberschatz convoy test passes (FCFS 17.0 vs RR 5.67 avg waiting); deterministic tick ordering verified. |
| **Phase 2** | **Virtual Memory & TLB** | FIFO, LRU, Optimal (MIN), Clock (second-chance), associative TLB cache, fixed/proportional frame allocation. | Belady's Anomaly test passes on `[1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5]` (9 faults on 3 frames vs 10 faults on 4 frames); TLB hit ratio computed. |
| **Phase 3** | **Sync & Deadlocks Lab** | `SimSemaphore`, `SimMutex`, Resource Allocation Graph (RAG) cycle detector, Banker's Algorithm. | Safe sequence $\langle P_1, P_3, P_4, P_0, P_2 \rangle$ verified on textbook matrix; unsafe request $[3, 3, 0]$ safely denied; cycle highlighted. |
| **Phase 4** | **Disk Schedulers & Workload** | 6 disk policies (FCFS, SSTF, SCAN, C-SCAN, LOOK, C-LOOK), cylinder bounds (0–199), PRNG workload generator. | Textbook 8-request queue seek distances verified (SSTF 236 cyl vs FCFS 640 cyl); repeatable seeded outputs. |
| **Phase 5** | **Allocators & Inode FS (Tier 2)** | Contiguous memory (First-Fit, Best-Fit, Worst-Fit), fragmentation analysis, inode filesystem, WAL journal crash recovery. | Allocator hole coalescing verified; WAL transactions replay cleanly from PreCommit vs PostCommit crash injection. |
| **Phase 6** | **D3.js Animated Frontend** | React + Vite + TS + D3 animated Gantt chart, scrub controls, memory frames, RAG visualizer, disk route, policy matrix, export drawer. | Interactive scrub without re-simulating; multi-policy delta matrix displayed; v1 JSON & CSV export operational. |
| **Phase 7** | **Empirical Complexity & MVD** | Benchmark suite, scaling tests against $N, M, K$, faculty 5-minute MVD walkthrough. | 100% automated tests pass (28/28); empirical scaling CSV exported; all 9 steps of `docs/demo-script.md` verified. |

---

## 4. Proposed Repository Tree

```text
kernellens/
├── CMakeLists.txt
├── CMakePresets.json
├── README.md
├── LICENSE
├── AGENTS.md
├── CLAUDE.md
├── .gitignore
├── docs/
│   ├── architecture.md
│   ├── event-schema.md
│   ├── algorithm-notes.md
│   ├── complexity.md
│   ├── test-plan.md
│   ├── report-outline.md
│   ├── demo-script.md
│   ├── risk-register.md
│   └── phase-reports/
│       ├── phase-0.md
│       └── ...
├── engine/
│   ├── include/kernellens/
│   │   ├── core/{types,event,clock,engine,event_log,metrics}.hpp
│   │   ├── cpu/{scheduler,fcfs,sjf,srtf,priority,round_robin,mlfq,cfs_like}.hpp
│   │   ├── memory/{page_replacer,replacers,paging_system,tlb,allocator}.hpp
│   │   ├── sync/{semaphore,mutex,resource_graph,banker}.hpp
│   │   ├── disk/{disk_scheduler,schedulers}.hpp
│   │   ├── filesystem/{inode,filesystem,journal}.hpp
│   │   └── workload/{generator,presets}.hpp
│   ├── src/...
│   ├── cli/main.cpp
│   └── wasm/bindings.cpp
├── tests/
│   ├── test_main.cpp
│   ├── unit/
│   ├── golden/
│   └── fixtures/
├── benchmarks/
│   ├── benchmark_main.cpp
│   └── results/
├── frontend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
│       ├── types/schema.ts
│       ├── bridge/simulationBridge.ts
│       ├── components/{Navbar,ExportDrawer}.tsx
│       ├── features/{CpuReplay,MemoryVisualizer,SyncVisualizer,DiskVisualizer,AllocatorVisualizer,FilesystemVisualizer,PolicyComparison}.tsx
│       ├── index.css
│       └── main.tsx
└── scripts/
    ├── build-native.ps1
    └── run-tests.ps1
```

---

## 5. Frontend Visual Stack Specification

- **Framework:** React 18 with Vite and TypeScript (Strict Mode).
- **Visualization Library:** **D3.js (v7)** is required and non-negotiable for:
  - **CPU Replay:** Animated Gantt chart rendered with SVG rectangles, time scale mapping (`d3.scaleLinear`), process band scales (`d3.scaleBand`), and scrubbing playhead cursor.
  - **Virtual Memory:** Dynamic frame residence grid, reference bit toggles, and TLB cache hit/miss animations.
  - **Deadlock Detection:** Bipartite Resource Allocation Graph (RAG) with process and resource nodes and highlighted directed cycle paths.
  - **Disk Head Route:** Trajectory graph plotting seek cylinder position (0–199) against sequential request servicing order.
  - **Comparative Analytics:** Grouped D3 bar charts comparing waiting time, turnaround time, response latency, and throughput across algorithms.

---

## 6. Final File List & Unresolved Assumptions

### Final File List for Phase 0
- [AGENTS.md](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/AGENTS.md): Team boundaries and collaboration protocol.
- [CLAUDE.md](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/CLAUDE.md): C++ and test workflow conventions.
- [.gitignore](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/.gitignore): Clean build and dependency exclusion rules.
- [CMakeLists.txt](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/CMakeLists.txt): Multi-target CMake build configuration.
- [CMakePresets.json](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/CMakePresets.json): Standardized debug and release presets.
- [docs/architecture.md](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/docs/architecture.md): Architectural specification.
- [docs/event-schema.md](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/docs/event-schema.md): Version 1 JSON event stream specification.
- [docs/algorithm-notes.md](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/docs/algorithm-notes.md): Tier 1 and Tier 2 algorithmic definitions.
- [docs/complexity.md](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/docs/complexity.md): Asymptotic complexity formulations.
- [docs/test-plan.md](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/docs/test-plan.md): Test hierarchy and golden verification matrices.
- [docs/report-outline.md](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/docs/report-outline.md): Final course report template.
- [docs/demo-script.md](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/docs/demo-script.md): 5-minute faculty evaluation walkthrough script.
- [docs/risk-register.md](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/docs/risk-register.md): Risk mitigation and scope cut-order matrix.
- [docs/phase-reports/phase-0.md](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/docs/phase-reports/phase-0.md): This verification report.

### Unresolved Assumptions & Design Decisions
1. **Context Switch Overhead:** Context-switch ticks are treated as separate non-work overhead states and do not count toward useful CPU utilization.
2. **Jain's Fairness Index Calculation:** Computed solely across processes concurrently active and runnable during an observation window to avoid distorting scores across unequal batch jobs.
3. **WASM vs Direct Client Bridge:** Full WASM build supported; client simulation bridge in TypeScript strictly mirrors C++17 discrete-event semantics to guarantee in-browser self-contained execution without external server requirements.
4. **Filesystem Scope (Tier 2):** Inode filesystem is an educational in-memory model designed for visualizing allocation structures and WAL crash injection; it does not aim to implement a full POSIX-compliant file system.
