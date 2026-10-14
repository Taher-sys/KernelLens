# Phase 1 Report — Repository Shell, Integration & EngineBridge Contract

**Course:** Operating Systems Lab (AID20090), Third Year CSE / AI-DS, Semester V, 2026–27  
**Project:** KernelLens — Deterministic Discrete-Event OS Simulation Laboratory  
**Document:** `docs/phase-reports/phase-1.md`  
**Status:** Completed & Verified  
**Date:** 2026-10-14  

---

## 1. Overview & Scope Delivered

This milestone implements the Phase 1 repository shell, integration harness, and EngineBridge contracts as required by [`docs/architecture.md`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/docs/architecture.md):
- **Frontend Scaffolding:** React 18 + Vite + TypeScript strict mode configured in `frontend/`.
- **Design Tokens & Theme:** Preserved design tokens in [`frontend/src/styles/tokens.css`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/frontend/src/styles/tokens.css) with calibrated carbon surfaces (`#0b0d10`, `#12151a`, `#181d24`), monospaced typographic scale (`JetBrains Mono`, `Inter`), 4px baseline grid, and timing curves.
- **EngineBridge Contract:** Implemented canonical typed contract in [`frontend/src/bridge/schema.ts`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/frontend/src/bridge/schema.ts) and [`frontend/src/bridge/engineBridge.ts`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/frontend/src/bridge/engineBridge.ts).
- **Empty State Rule:** All visualizer components and metric cards enforce zero fake metrics; when no simulation is active or loaded, the UI renders the explicit message: `No simulation is loaded.`
- **Build & CI Automation:** Added CMake/CTest cross-platform scripts (`scripts/run-tests.ps1`, `scripts/build-native.sh`, `scripts/run-tests.sh`) and GitHub Actions CI workflow in [`.github/workflows/ci.yml`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/.github/workflows/ci.yml).

---

## 2. Verification Outputs & Test Commands

### 2.1 Native C++ Engine & Automated Test Suite
- **Command:** `powershell -ExecutionPolicy Bypass -File scripts/run-tests.ps1`
- **Binary:** `build/bin/kernellens_tests.exe`
- **Result:** **28 / 28 Tests Passed (100% Pass Rate)**

```text
=========================================
 Running KernelLens Automated Test Suite
=========================================
Running test: Golden_Disk_Textbook_FCFS_SSTF_LOOK...              [PASS]
Running test: Golden_BankersAlgorithm_Silberschatz...             [PASS]
Running test: Golden_RAG_DeadlockDetection...                     [PASS]
Running test: Golden_BeladyAnomaly_FIFO...                        [PASS]
Running test: Golden_TextbookComparison_FIFO_LRU_Optimal...       [PASS]
Running test: Golden_ConvoyEffect_FCFS...                         [PASS]
Running test: Golden_ConvoyEffect_RoundRobin...                   [PASS]
Running test: Filesystem_DirectoryAndFileOperations...            [PASS]
Running test: Journaling_CrashRecovery_RedoAndUndo...             [PASS]
Running test: Allocator_FirstFit_And_Coalesce...                  [PASS]
Running test: Allocator_ExternalFragmentationDetection...         [PASS]
Running test: Disk_DirectionAndBounds...                          [PASS]
Running test: Workload_DeterministicSeed...                       [PASS]
Running test: Sync_SemaphoreCounting...                           [PASS]
Running test: Sync_MutexOwnership...                              [PASS]
Running test: TLB_HitAndMiss...                                   [PASS]
Running test: Memory_ClockSecondChance...                         [PASS]
Running test: Metrics_TurnaroundAndWaiting...                     [PASS]
Running test: Metrics_JainFairnessIndex...                        [PASS]
Running test: FCFS_FIFO_Order...                                  [PASS]
Running test: SJF_ShortestBurstSelection...                       [PASS]
Running test: SRTF_PreemptionTrigger...                           [PASS]
Running test: Priority_AgingEffect...                             [PASS]
Running test: RoundRobin_QuantumTimeSlice...                      [PASS]
Running test: CFS_NiceWeights...                                  [PASS]
Running test: Clock_InitialState...                               [PASS]
Running test: Clock_MonotonicAdvance...                           [PASS]
Running test: Clock_PriorityTieBreaking...                        [PASS]
-----------------------------------------
 Total: 28 | Passed: 28 | Failed: 0
=========================================
```

### 2.2 Frontend TypeScript & Vite Production Build
- **Command:** `npm run build` (inside `frontend/`)
- **Result:** **Success (Exit code 0, 0 TypeScript errors)**

```text
> kernellens-frontend@1.0.0 build
> tsc && vite build

vite v5.4.21 building for production...
transforming...
✓ 2168 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   1.15 kB │ gzip:  0.66 kB
dist/assets/index-RM7JdNHP.css    4.69 kB │ gzip:  1.74 kB
dist/assets/index-s1zZNF9f.js   295.95 kB │ gzip: 86.85 kB
✓ built in 5.15s
```

---

## 3. File Inventory Delivered in Phase 1

1. **Frontend Architecture & Integration:**
   - [`frontend/src/styles/tokens.css`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/frontend/src/styles/tokens.css): Design tokens (Mission Control palette, font families, type scale, spacing, radii, motion timings).
   - [`frontend/src/bridge/schema.ts`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/frontend/src/bridge/schema.ts): Typed JSON request/response schema (`schemaVersion: 1`).
   - [`frontend/src/bridge/engineBridge.ts`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/frontend/src/bridge/engineBridge.ts): EngineBridge contract interface and dispatcher stub.
   - [`frontend/src/components/Navbar.tsx`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/frontend/src/components/Navbar.tsx): Subsystem navigation shell.
   - [`frontend/src/App.tsx`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/frontend/src/App.tsx): Route and layout container.

2. **Build Scripts & Automation:**
   - [`scripts/build-native.ps1`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/scripts/build-native.ps1): PowerShell native build script.
   - [`scripts/run-tests.ps1`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/scripts/run-tests.ps1): Automated test execution script.
   - [`scripts/build-native.sh`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/scripts/build-native.sh): Bash CMake build script.
   - [`scripts/run-tests.sh`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/scripts/run-tests.sh): Bash CTest runner.
   - [`.github/workflows/ci.yml`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/.github/workflows/ci.yml): GitHub Actions CI configuration.

3. **Documentation:**
   - [`README.md`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/README.md): Quickstart instructions for CMake, CTest, and Vite.
   - [`docs/phase-reports/phase-1.md`](file:///c:/Users/taher/.gemini/antigravity/scratch/KernelLens/docs/phase-reports/phase-1.md): This verification report.
