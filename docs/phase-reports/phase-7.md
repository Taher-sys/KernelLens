# Phase 7 Report — KernelLens Mission Control Frontend

**Course:** Operating Systems Lab (AID20090), Third Year CSE / AI-DS, Semester V, 2026–27  
**Project:** KernelLens — Deterministic Discrete-Event OS Simulation Laboratory  
**Document:** `docs/phase-reports/phase-7.md`  
**Status:** Complete — Mission Control frontend implemented with React 18, Vite, TypeScript, and D3.js adhering strictly to `docs/ux-system.md` and `docs/event-schema.md`  

---

## 1. Executive Summary

Phase 7 delivers the production-grade **KernelLens Mission Control** frontend. Moving away from generic administrative templates and standard CSS frameworks, Mission Control is engineered as a dedicated scientific operating system instrument. It features dark carbon instrumentation panels, high-contrast monospace telemetry, multi-lane D3.js timeline scheduling visualizations, textbook workload modeling, concurrent multi-policy comparison, and full accessibility/keyboard controls.

### Core Architectural Achievements:
1. **Mission Control AppShell (`frontend/src/components/layout/AppShell.tsx`)**:
   - 3-column workstation grid: Workload Builder (left), D3 Gantt & Queue Inspector (center), Live Telemetry & Event Stream Log (right).
   - Fixed docked bottom Master Simulation Deck (`ReplayControls.tsx`).
   - Subsystem switcher (CPU, Compare, Memory, Sync, Disk) with single-key access (`1`, `C`, `2`, `3`, `4`).
   - Verified `schemaVersion: 1` contract badge, deterministic PRNG seed indicator, CSV/JSON export modal, and keyboard help modal.
2. **Multi-Lane D3.js Gantt Timeline (`frontend/src/features/cpu/GanttTimeline.tsx`)**:
   - D3 linear time scale with integer tick snapping.
   - Core 0 aggregate execution lane displaying CPU occupancy and context switches.
   - Labeled process rows with state color coding (`RUNNING`, `WAITING`, `CONTEXT_SWITCH`).
   - Visualized quantum boundaries and preemption markers.
   - Current-time hairline playhead with $T=\{now\}$ reverse-triangle flag and click-to-scrub.
   - Dynamic zoom controls (`1x`, `1.5x`, `2x`, `3x`) and interactive SVG hover tooltips displaying microsecond details and events.
3. **Real-time Queue Inspector (`frontend/src/features/cpu/ProcessStateLanes.tsx`)**:
   - Live queues for `RUNNING`, `READY`, `WAITING (I/O)`, and `TERMINATED` states driven strictly by the replay engine state.
4. **Multi-Policy Comparison Lab (`frontend/src/features/compare/CompareView.tsx` & `MetricDeltaTable.tsx`)**:
   - Concurrently executes user-selected policies on identical workload and seed.
   - Quantitative metric delta board with raw metrics and relative deltas ($\Delta$) against a selectable baseline policy (e.g., FCFS, Round Robin).
   - Best-in-class performance badges (Lowest Wait, Lowest Turnaround, Most Fair).
   - Avoids misleading unlabeled radar charts; provides definitive numeric tables with synchronized dual-Gantt replay.
5. **Textbook Workload Builder (`frontend/src/features/workload/WorkloadBuilder.tsx`)**:
   - Custom process builder supporting arrival time, CPU burst, I/O burst, and priority/nice values.
   - Five textbook scenario presets: Convoy Effect (Silberschatz), Shortest Job First Benchmark, Priority Inversion / Aging, Interactive Mixed Workload, and Multilevel Feedback Queue (MLFQ).
6. **Data Export & Ergonomics**:
   - Export simulation event logs and metrics to normalized JSON (`schemaVersion: 1`) and tabular CSV.
   - Full keyboard shortcuts (`Space`, `ArrowLeft`, `ArrowRight`, `Home`, `End`, `?`, `1-4`, `C`).
   - Reduced-motion mode toggling instantaneous transitions.

---

## 2. Component Architecture & Data Flow

```text
┌────────────────────────────────────────────────────────────────────────┐
│             KernelLens Mission Control AppShell (AppShell.tsx)         │
├───────────────────┬────────────────────────────────┬───────────────────┤
│  WorkloadBuilder  │     GanttTimeline (D3.js)      │  Engine Telemetry │
│   - Custom Burst  │   - Core 0 Aggregate Lane      │   - Raw Metrics   │
│   - I/O Bursts    │   - Process Rows & Quantum     │   - Event Stream  │
│   - 5 Presets     │   - Hairline Playhead T={now}  │     Log Filter    │
│   - Policy Config │   - SVG Hover Tooltip          │   - schemaVersion │
│                   │                                │     Badge         │
│                   │   ProcessStateLanes            │                   │
│                   │   - RUNNING / READY / WAITING  │                   │
├───────────────────┴────────────────────────────────┴───────────────────┤
│            Master Simulation Deck Docked (ReplayControls.tsx)           │
│    [Play/Pause] [Prev/Next Step] [Timeline Scrubber] [Speed 0.25x-4x]   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Verified Browser Testing Across Viewports

The Mission Control frontend was validated using autonomous browser subagent testing against `http://localhost:5173/` at desktop, tablet, and mobile dimensions:

| Viewport | Dimensions | Layout State | Verified Behaviors |
| :--- | :--- | :--- | :--- |
| **Desktop** | $1440 \times 900$ | 3-Column Instrumentation Grid | D3 Gantt rendering, scrubber dragging, playback, zoom buttons (`1x`, `1.5x`, `2x`), hover tooltips, keyboard modal (`?`), export modal, Compare mode with delta board. |
| **Tablet** | $768 \times 1024$ | Adaptive Responsive Grid | Layout cleanly adapts without horizontal overflow; Gantt chart retains tick labels and playback deck stays accessible. |
| **Mobile** | $375 \times 812$ | Vertically Stacked Panels | Workload builder, metrics, and queue lanes stack cleanly; controls remain touch-friendly and readable. |

### Console & Error Integrity
- **Console Errors:** `0` errors or unhandled exceptions.
- **Layout Overflows:** Zero clipping or unstyled elements.
- **WASM/Worker Integration:** State transitions and checkpoint scrubbing operate smoothly with zero reverse mutations.

---

## 4. Test Suite Execution & Verification

### 4.1 Frontend Automated Test Suites (`npm test`)
```text
> npm test
> npm run test:contract && npm run test:memory && npm run test:sync && npm run test:phase5 && npm run test:replay

[PASS] Frontend Bridge Contract Tests (5/5)
[PASS] Memory UI & Belady Anomaly Contract Tests (5/5)
[PASS] Phase 4 Concurrency & Banker's Algorithm Tests (6/6)
[PASS] Phase 5 Disk Scheduling & Dynamic Memory Allocator Tests (6/6)
[PASS] WASM/Worker Bridge & Replay State Machine Tests (5/5)

Total: 27/27 Tests Passed (100% Pass Rate)
```

### 4.2 C++ Discrete-Event Simulation Tests (`kernellens_tests.exe`)
```text
[PASS] 28/28 Unit and Golden Tests Passed
- CPU Schedulers: FCFS, SJF, SRTF, Round Robin, Priority (Preemptive & Non-preemptive)
- Multi-queue MLFQ with starvation aging
- Core Discrete-Event Simulation Engine Total Ordering: (Time, Priority, Seq)
```

### 4.3 Production Build Validation (`npm run build`)
```text
> tsc && vite build
✓ 2186 modules transformed.
dist/index.html                              1.15 kB │ gzip:   0.66 kB
dist/assets/simulation.worker-pza7grHj.js   45.68 kB
dist/assets/index-CVgQna1v.css               5.87 kB │ gzip:   1.96 kB
dist/assets/index-zijyy6ku.js              442.07 kB │ gzip: 113.87 kB
✓ built in 9.28s (Exit Code: 0)
```

---

## 5. Artifacts and Demonstration Steps

### How to Run Locally:
1. Start the development server:
   ```bash
   cd frontend
   npm run dev
   ```
2. Open `http://localhost:5173/` in any modern web browser.
3. Press `Space` to play/pause the discrete-event simulation.
4. Press `ArrowRight` / `ArrowLeft` to step forward and backward.
5. Press `C` to switch to Multi-Policy Compare Mode.
6. Select any of the 5 textbook scenario presets in the Workload Builder to instantly observe scheduling phenomena (e.g., Convoy Effect, Shortest Job First, MLFQ).
7. Click **Export** to download the raw event stream (`schemaVersion: 1`) or CSV metrics.
