# Phase 6 Report — Frontend Visual Replay & D3.js Animation Laboratory

**Date:** 2026-10-14  
**Component:** React 18 + Vite + TypeScript + D3.js Frontend Visualizer  
**Status:** Complete  
**Engine Contract Version:** v1 (`docs/event-schema.md`)

---

## 1. Overview & Achievements

Phase 6 delivers the complete interactive visual replay laboratory for KernelLens. Built using React 18, Vite, TypeScript, D3.js, and a bespoke VengeanceUI-inspired glassmorphism design system (`tokens.css`), the frontend provides students and faculty with real-time inspection, replay, scrubbing, and quantitative comparisons across every operating-system subsystem.

### Key Visualizers & Modules Implemented

1. **CPU Replay (`CpuReplay.tsx`):**
   - D3.js animated Gantt chart with integer simulation ticks (`int64_t`).
   - Time scrubbing slider, play/pause controls, and adjustable playback speed (0.5x, 1x, 2x, 5x).
   - Real-time process queue inspector (`RUNNING`, `READY`, `WAITING`, `TERMINATED`).
   - Built-in workload presets: Silberschatz Convoy Effect, Interactive Mixed Bursts, Starvation/Aging, and SJF Staggered.
   - Live metrics dashboard: Average Waiting Time, Turnaround Time, Response Time, Throughput, CPU Utilization, and Context Switches.

2. **Virtual Memory & Paging (`MemoryVisualizer.tsx`):**
   - Interactive physical frame inspector with reference bits, load ticks, and last-used timestamps.
   - TLB hit/miss associative cache tracking with dynamic hit ratio computation.
   - Step-by-step page reference replay with fault badges and victim replacement explanations.
   - Dedicated **Belady's Anomaly Demonstration** comparing FIFO on 3 vs 4 frames using the textbook string `[1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5]` (proving 9 faults on 3 frames vs 10 faults on 4 frames).

3. **Synchronization & Deadlock Detection (`SyncVisualizer.tsx`):**
   - Resource Allocation Graph (RAG) visualizer with process and resource nodes.
   - Tarjan/DFS cycle detection with highlighted deadlock loops.
   - Interactive Banker's Algorithm matrix inspector ($Allocation$, $Max$, $Need$, $Available$).
   - Step-by-step safe sequence verification (e.g. textbook `<P1, P3, P4, P0, P2>`).
   - Safe vs unsafe request tester with speculative evaluation and rollback.

4. **Disk Head Route Visualizer (`DiskVisualizer.tsx`):**
   - Circular/linear 0–199 cylinder track display showing current head position.
   - D3.js seek trajectory route plot graphing seek order over time.
   - Comparison across all 6 disk schedulers: FCFS, SSTF, SCAN, C-SCAN, LOOK, C-LOOK.
   - Metrics: Total Seek Distance (cylinders) and Average Seek per Request.

5. **Contiguous Allocator Visualizer (`AllocatorVisualizer.tsx` - Tier 2):**
   - Visual memory layout strip showing allocated partitions and free holes.
   - Interactive First-Fit, Best-Fit, and Worst-Fit allocation and deallocation.
   - External and internal fragmentation tracking with automatic hole coalescing.

6. **Inode Filesystem & WAL Journaling (`FilesystemVisualizer.tsx` - Tier 2):**
   - Inode metadata and hierarchical directory explorer.
   - Write-Ahead Logging (WAL) transaction state machine (`Committed`, `Flushed`, `Applied`).
   - Crash injection at critical transaction points and recovery replay.

7. **Multi-Policy Quantitative Comparison Matrix (`PolicyComparison.tsx`):**
   - Simultaneous side-by-side execution of all 7 CPU policies on the identical workload.
   - D3.js grouped bar charts comparing Waiting, Turnaround, and Response times.
   - Best-in-class winner highlight cards for lowest waiting, lowest turnaround, and highest Jain fairness.
   - Formal mathematical metric definitions and simulation invariants.

8. **Export Drawer (`ExportDrawer.tsx`):**
   - One-click export of normalized JSON event stream (`v1` schema).
   - Formatted CSV export for statistical analysis.
   - Seed and configuration metadata preserved for byte-for-byte reproducibility.

---

## 2. Design System & Aesthetics

- **Theme:** Curated dark mode (`#070a12`, `#0b0f19`) with cyan/blue accents (`#00f2fe`, `#4facfe`) and subtle glow borders (`rgba(0, 242, 254, 0.2)`).
- **Typography:** Plus Jakarta Sans for UI elements and Fira Code for code blocks, metrics, and memory addresses.
- **Micro-animations:** Smooth transitions on hover, state changes, and D3 bar updates.
- **Responsiveness:** Fluid grid layout supporting multi-monitor display and compact laptop screens.

---

## 3. Verification & Acceptance Criteria

- [x] All 7 CPU algorithms supported and inspectable.
- [x] D3 Gantt chart with play/pause, scrub, and speed controls.
- [x] Belady's anomaly reproducible in under 2 clicks.
- [x] Banker safe sequence `<P1, P3, P4, P0, P2>` and unsafe request rejection.
- [x] Disk seek trajectories for 6 policies.
- [x] Quantitative comparison matrix with export to JSON/CSV.
- [x] Zero TypeScript errors.
