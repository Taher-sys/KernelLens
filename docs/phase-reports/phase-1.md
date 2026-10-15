# Phase 1 Report — Repository Shell & Integration

**Course:** Operating Systems Lab (AID20090), Third Year CSE / AI-DS, Semester V, 2026–27  
**Project:** KernelLens — Deterministic Discrete-Event OS Simulation Laboratory  
**Document:** `docs/phase-reports/phase-1.md`  
**Status:** Complete — Repository shell, build automation, CI pipeline, and frontend bridge scaffolded  

---

## 1. Executive Summary

Phase 1 establishes the repository foundation, build pipelines, and core integration shell for KernelLens. The architecture strictly follows `docs/architecture.md`, maintaining total separation between the deterministic C++17 discrete-event simulation engine and the React + Vite + TypeScript frontend.

All empty states strictly display `"No simulation is loaded."` with zero invented metrics or fake visualizations.

---

## 2. Key Deliverables

| Component | Path | Description | Status |
|---|---|---|---|
| Frontend Scaffolding | `frontend/` | React 18, Vite 5, TypeScript 5, D3.js v7 | Complete |
| Route / Layout Shell | `frontend/src/App.tsx`, `Navbar.tsx` | Navigation across CPU, Memory, Sync, Disk, Allocator, Filesystem, and Comparison | Complete |
| Theme Token File | `frontend/src/styles/tokens.css` | Design system tokens: canvas/surface palettes, typography, spacing, $\le 4\text{px}$ radii, animation timing | Complete |
| Bridge Schema | `frontend/src/bridge/schema.ts` | Normalized event contract (`schemaVersion: 1`), typed requests, responses, and metrics | Complete |
| Engine Bridge | `frontend/src/bridge/engineBridge.ts` | Typed `IEngineBridge` dispatch interface, shape validation, and policy checks | Complete |
| Build Scripts | `scripts/build-native.ps1`, `build-native.sh` | Automated compilation of CLI, test suite, and benchmarks | Complete |
| Test Runner | `scripts/run-tests.ps1`, `run-tests.sh` | Execution harness for native automated test suite | Complete |
| CMake / CTest | `CMakeLists.txt` | Top-level C++17 build with `enable_testing()` and CTest harness | Complete |
| CI Pipeline | `.github/workflows/ci.yml` | GitHub Actions workflow for native C++ build/test and frontend build | Complete |
| Documentation | `README.md`, `.gitignore` | Local setup guide, quickstart commands, and build artifact exclusions | Complete |

---

## 3. Architecture & Integration Verification

### 3.1 Design System & Theme Tokens (`frontend/src/styles/tokens.css`)
- Scoped under `:root { ... }` with CSS custom properties.
- **Palette Integrity**: Canonical dark-mode colors preserved (`#0b0d10`, `#12151a`, `#181d24`, `#1f252e`, `#262d38`).
- **Typography Scale**: High-density instrumentation hierarchy referencing `--font-sans` (`Inter` / `Plus Jakarta Sans`) and `--font-mono` (`JetBrains Mono` / `Fira Code`).
- **Mechanical Geometry**: Strict constraint enforcing $\le 4\text{px}$ border radii to ensure an authentic operating system lab aesthetic.

### 3.2 Bridge Contract (`frontend/src/bridge/schema.ts`)
- Implements `schemaVersion: 1` as defined in `docs/event-schema.md`.
- `SimEvent`: Normalized discrete event with integer simulation ticks (`time: int64_t`), `subsystem`, `seq`, `type`, and `details`.
- `SimulationRequest` & `SimulationResponse`: Total encapsulation of simulation inputs and outputs.
- `IEngineBridge.run(request)`: Async dispatch contract validating response shape and rejecting unsupported policies with explicit errors.

### 3.3 Empty State Adherence
- Zero fake charts or fabricated system metrics are displayed.
- When no simulation has been loaded or an empty workload is selected, components explicitly render:
  ```text
  No simulation is loaded.
  ```

---

## 4. Build & Test Verification

### 4.1 Native C++ Compilation (`scripts/build-native.ps1`)
```text
Using C++ Compiler: C:\msys64\ucrt64\bin\g++.exe
Building kernellens CLI...
Building test suite...
Building benchmark suite...
Build complete! Executables located in build/bin/ (kernellens.exe, kernellens_tests.exe, kernellens_benchmarks.exe)
```

### 4.2 Native Automated Test Suite (`scripts/run-tests.ps1`)
```text
Executing KernelLens automated test suite (build/bin/kernellens_tests.exe)...

=========================================
 Running KernelLens Automated Test Suite
=========================================
Running test: Golden_Disk_Textbook_FCFS_SSTF_LOOK...
 [PASS] Golden_Disk_Textbook_FCFS_SSTF_LOOK
Running test: Golden_BankersAlgorithm_Silberschatz...
 [PASS] Golden_BankersAlgorithm_Silberschatz
Running test: Golden_RAG_DeadlockDetection...
 [PASS] Golden_RAG_DeadlockDetection
Running test: Golden_BeladyAnomaly_FIFO...
 [PASS] Golden_BeladyAnomaly_FIFO
Running test: Golden_TextbookComparison_FIFO_LRU_Optimal...
 [PASS] Golden_TextbookComparison_FIFO_LRU_Optimal
Running test: Golden_ConvoyEffect_FCFS...
 [PASS] Golden_ConvoyEffect_FCFS
Running test: Golden_ConvoyEffect_RoundRobin...
 [PASS] Golden_ConvoyEffect_RoundRobin
Running test: Filesystem_DirectoryAndFileOperations...
 [PASS] Filesystem_DirectoryAndFileOperations
Running test: Journaling_CrashRecovery_RedoAndUndo...
 [PASS] Journaling_CrashRecovery_RedoAndUndo
Running test: Allocator_FirstFit_And_Coalesce...
 [PASS] Allocator_FirstFit_And_Coalesce
Running test: Allocator_ExternalFragmentationDetection...
 [PASS] Allocator_ExternalFragmentationDetection
Running test: Disk_DirectionAndBounds...
 [PASS] Disk_DirectionAndBounds
Running test: Workload_DeterministicSeed...
 [PASS] Workload_DeterministicSeed
Running test: Sync_SemaphoreCounting...
 [PASS] Sync_SemaphoreCounting
Running test: Sync_MutexOwnership...
 [PASS] Sync_MutexOwnership
Running test: TLB_HitAndMiss...
 [PASS] TLB_HitAndMiss
Running test: Memory_ClockSecondChance...
 [PASS] Memory_ClockSecondChance
Running test: Metrics_TurnaroundAndWaiting...
 [PASS] Metrics_TurnaroundAndWaiting
Running test: Metrics_JainFairnessIndex...
 [PASS] Metrics_JainFairnessIndex
Running test: FCFS_FIFO_Order...
 [PASS] FCFS_FIFO_Order
Running test: SJF_ShortestBurstSelection...
 [PASS] SJF_ShortestBurstSelection
Running test: SRTF_PreemptionTrigger...
 [PASS] SRTF_PreemptionTrigger
Running test: Priority_AgingEffect...
 [PASS] Priority_AgingEffect
Running test: RoundRobin_QuantumTimeSlice...
 [PASS] RoundRobin_QuantumTimeSlice
Running test: CFS_NiceWeights...
 [PASS] CFS_NiceWeights
Running test: Clock_InitialState...
 [PASS] Clock_InitialState
Running test: Clock_MonotonicAdvance...
 [PASS] Clock_MonotonicAdvance
Running test: Clock_PriorityTieBreaking...
 [PASS] Clock_PriorityTieBreaking
-----------------------------------------
 Total: 28 | Passed: 28 | Failed: 0
=========================================

All automated tests executed successfully!
```

### 4.3 Frontend Production Build (`npm run build`)
```text
> kernellens-frontend@1.0.0 build
> tsc && vite build

vite v5.4.21 building for production...
transforming...
✓ 2174 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   1.15 kB │ gzip:  0.66 kB
dist/assets/index-RM7JdNHP.css    4.69 kB │ gzip:  1.74 kB
dist/assets/index-Uns0wYD2.js   360.23 kB │ gzip: 96.18 kB
✓ built in 3.54s
```

### 4.4 Frontend Bridge Contract Tests (`npm run test:contract`)
```text
> kernellens-frontend@1.0.0 test:contract
> tsx src/tests/contract.test.ts

========================================================
   Running KernelLens Frontend Bridge Contract Tests    
========================================================

Test 1: Validating FCFS SimulationResponse shape...
 [PASS] FCFS SimulationResponse shape verified.

Test 2: Validating Round Robin Convoy Effect contract...
 [PASS] Round Robin Convoy metrics contract verified.

Test 3: Validating error handling for unsupported policy names...
 [PASS] Unsupported policy error correctly rejected.

Test 4: Validating error handling for null/empty request...
 [PASS] Null request correctly rejected.

Test 5: Verifying all 7 supported CPU policies execute...
 [PASS] All 7 CPU policies verified.

========================================================
   ALL FRONTEND BRIDGE CONTRACT TESTS PASSED (5/5)      
========================================================
```

---

## 5. Conclusion & Status

Phase 1 repository scaffolding and integration is verified and complete. All build scripts, CI definitions, theme tokens, and bridge contracts are operational with zero test failures.
