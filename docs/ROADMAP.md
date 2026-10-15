# KernelLens — Engineering Roadmap (Phases 0–15)

**Course:** Operating Systems Lab (AID20090), Third Year CSE / AI-DS, Semester V, 2026–27  
**Project:** KernelLens — Deterministic Discrete-Event OS Simulation Laboratory  
**Document:** `docs/ROADMAP.md`  
**Status:** Living Engineering Document  

---

## 1. Executive Roadmap Architecture

KernelLens is structured into 16 discrete, sequentially verifiable engineering phases. Each phase concludes with passing unit and golden tests, an audit report in `docs/phase-reports/`, zero regressions across previous subsystems, and verifiable CLI / integration contracts.

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        COMPLETED FOUNDATION (0–11)                     │
│ Phase 0: Blueprints & Governance    Phase 6: WebAssembly/Replay Bridge │
│ Phase 1: Clock & CPU Schedulers     Phase 7: Mission Control Frontend  │
│ Phase 2: Virtual Memory & TLB       Phase 8: Workload Gen & Comparator │
│ Phase 3: Synchronization & Deadlock Phase 9: Buddy & Dynamic Memory    │
│ Phase 4: Disk Schedulers & PRNG     Phase 10: Ext2 Filesystem & WAL    │
│ Phase 5: Allocators & Inode FS      Phase 11: IPC, Syscalls & IVT      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                       UPCOMING PHASES (12–15)                          │
│ Phase 12: Advanced Memory Extensions (Working-Set & Thrashing Lab)     │
│ Phase 13: Empirical Trace Ingestion & Burst-Time Prediction            │
│ Phase 14: Cross-Module Unified Orchestration & Full Benchmarks         │
│ Phase 15: Final Documentation, Complexity Thesis & Course Defense      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Phase-by-Phase Status & Scope Matrix

| Phase | Subsystem / Focus | Scope & Deliverables | Status | Tests | Report |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Phase 0** | **Governance & Specs** | Architecture blueprints, event schema (`schemaVersion: 1`), test plan, complexity analysis, CMake presets. | **Complete** | N/A | [`phase-0.md`](phase-reports/phase-0.md) |
| **Phase 1** | **Discrete Clock & CPU** | Monotonic tick clock, event queue, `EventLog`, 7 CPU schedulers (FCFS, SJF, SRTF, Priority w/ aging, RR, MLFQ, CFS-like vruntime). | **Complete** | 7/7 | [`phase-1.md`](phase-reports/phase-1.md) |
| **Phase 2** | **Virtual Memory & TLB** | Demand paging, FIFO, LRU, Optimal (MIN), Clock (second-chance), associative TLB cache, Belady's anomaly demonstration. | **Complete** | 5/5 | [`phase-2.md`](phase-reports/phase-2.md) |
| **Phase 3** | **Sync & Deadlocks Lab** | Counting & Binary Semaphores, Mutex, Resource Allocation Graph (RAG) Tarjan/DFS cycle detector, Banker's Algorithm safe-state analyzer. | **Complete** | 5/5 | [`phase-3.md`](phase-reports/phase-3.md) |
| **Phase 4** | **Disk Schedulers & PRNG** | 6 disk policies (FCFS, SSTF, SCAN, C-SCAN, LOOK, C-LOOK), cylinder bounds (0–199), PRNG workload generator. | **Complete** | 5/5 | [`phase-4.md`](phase-reports/phase-4.md) |
| **Phase 5** | **Allocators & Inode FS (Tier 2)** | Contiguous memory allocation (First-Fit, Best-Fit, Worst-Fit), fragmentation analysis, in-memory inode filesystem, WAL journal crash recovery. | **Complete** | 6/6 | [`phase-5.md`](phase-reports/phase-5.md) |
| **Phase 6** | **WASM/Worker & Replay UI** | Web Worker simulation thread, typed engine bridge, time-travel scrubbing state machine (zero reverse mutations), Replay UI. | **Complete** | 5/5 | [`phase-6.md`](phase-reports/phase-6.md) |
| **Phase 7** | **Mission Control Frontend** | Complete React 18 + D3.js workstation, multi-lane Gantt timeline, live queue lanes, comparison delta board, 5 textbook presets, empirical benchmarks. | **Complete** | 27/27 UI, 28/28 C++ | [`phase-7.md`](phase-reports/phase-7.md) |
| **Phase 8** | **Workload Gen, Comparator & Replay** | Native C++ multi-policy `ComparisonEngine` (CPU, Disk, Memory) with delta metrics & badges; `WorkloadGenerator` distributions (Uniform, Exponential, Bimodal, Normal) & JSON I/O; `ReplayEngine` with periodic snapshots ($K=50$) & binary search time-travel scrubbing. | **Complete** | 39/39 C++, 27/27 UI | [`phase-8.md`](phase-reports/phase-8.md) |
| **Phase 9** | **Advanced Dynamic Memory** | Binary Buddy Allocator ($2^k$ blocks, XOR buddy coalescing), Contiguous Allocation policies (First-Fit, Best-Fit, Worst-Fit), fragmentation accounting ($I_{\text{frag}}, E_{\text{frag}}, \Phi_{\text{ext}}$), memory compaction simulation, allocator comparator. | **Complete** | 52/52 C++, 27/27 UI | [`phase-9.md`](phase-reports/phase-9.md) |
| **Phase 10** | **Simulated Filesystem** | Ext2-style hierarchical inode tree, Contiguous/Linked/Indexed allocation strategies, directories, permissions (rwx/mode/uid/gid), capacity limits, write-ahead journaling & crash recovery (redo/undo). | **Complete** | 60/60 C++, 27/27 UI | [`phase-10.md`](phase-reports/phase-10.md) |
| **Phase 11** | **IPC & Syscall Abstraction** | Message queues, UNIX-style pipes, shared memory segment simulator with concurrent write race detection, kernel mode / user mode privilege transitions (Trap 0x80), 256-vector IVT with nested priority preemption. | **Complete** | 77/77 C++, 27/27 UI | [`phase-11.md`](phase-reports/phase-11.md) |
| **Phase 12** | **Advanced Memory Extensions** | Working-set page replacement model, page fault frequency (PFF) thrashing detector, NUMA / multicore CPU scheduling & affinity. | *Next Phase* | Planned | `phase-12.md` |
| **Phase 13** | **Trace Ingestion & Burst Predictor** | Real-world trace ingestion (e.g., Google Cluster Trace / Linux `/proc` sampling), exponential smoothing ($\tau_{n+1} = \alpha t_n + (1-\alpha)\tau_n$) burst prediction experiments. | *Planned* | Planned | `phase-13.md` |
| **Phase 14** | **Cross-Module Unified Laboratory** | Full engine orchestration, comprehensive cross-module golden test matrix, end-to-end integration verification, automated JSON validator. | *Planned* | Planned | `phase-14.md` |
| **Phase 15** | **Documentation & Release Readiness** | Final course thesis, LaTeX lab report compilation, faculty demonstration script rehearsal, release packaging. | *Planned* | Planned | `phase-15.md` |

---

## 3. Explicit Acceptance Criteria for Phase 8 (Verified)

1. **Deterministic Workload Generation & JSON I/O**:
   - `WorkloadGenerator` supports 4 burst distributions: `Uniform`, `Exponential` (Poisson process), `Bimodal` (75% short / 25% long), and `Normal` (Gaussian).
   - Generates clustered and sequential disk seek patterns and 80/20 locality page reference strings.
   - Self-contained, dependency-free `to_json()`, `from_json()`, `save_to_file()`, and `load_from_file()` adhering to `schemaVersion: 1`.
2. **Native C++ Algorithm Comparison Engine**:
   - `ComparisonEngine` executes policies against identical workloads with byte-for-byte determinism.
   - Computes mathematical metric deltas ($\Delta$) and relative percentage changes ($(\text{val} - \text{baseline}) / \text{baseline} \times 100\%$).
   - Generates best-in-class badges (`Lowest Wait`, `Lowest Turnaround`, `Minimum Seek Distance`, `Fewest Page Faults`, `Most Fair`).
   - Formats results into structured ASCII tables, normalized JSON, and tabular CSV.
3. **Deterministic Checkpoint Replay Engine**:
   - Captures periodic state snapshots every $K$ events ($K=50$ per ADR-03).
   - $O(\log S)$ binary search lookup for nearest checkpoint prior to target tick $T$.
   - Forward reconstruction verifying 100% state match against reference execution (Zero Reverse Mutations).
   - Full time-travel scrubbing verified via `--scrub <t1,t2,...>` in the CLI.
4. **Testing & Invariants**:
   - 100% automated test pass rate (39/39 native C++ tests, 27/27 frontend contract tests).
   - Golden comparison tests for Silberschatz Convoy Effect (FCFS vs Round Robin $\Delta \text{wait} = -12.0$ ticks) and disk seek distance (FCFS vs SSTF $\Delta \text{seek} = -404$ cylinders).
