# Phase 0 Report — Architecture, Blueprint & Project Scaffolding

**Course:** Operating Systems Lab (AID20090)  
**Project:** KernelLens — Deterministic Discrete-Event OS Simulation Lab  
**Phase:** 0 — Scaffolding & Specifications  
**Status:** Completed & Approved

---

## 1. Accomplishments

1. **Protocol & Collaboration Rules Established**:
   - `AGENTS.md` and `CLAUDE.md` define exact boundaries, single-writer invariants, and deterministic simulation guidelines.
   - Standardized on C++17 discrete-event simulation engine with integer ticks (`int64_t`).

2. **Core Specifications Formulated**:
   - `docs/architecture.md`: System layout, total event ordering `(time, priority, seq)`, time-travel snapshot replay architecture.
   - `docs/event-schema.md`: Version 1 normalized event definitions across CPU, memory, sync, disk, and filesystem subsystems.
   - `docs/algorithm-notes.md`: Mathematical formulations for all Tier 1 algorithms (FCFS, SJF, SRTF, Priority with aging, RR, MLFQ, CFS-like, FIFO, LRU, Optimal, Clock, Semaphores, RAG, Banker's, Disk schedulers) and Tier 2 extensions.
   - `docs/complexity.md`: Exact asymptotic time and space complexities.
   - `docs/test-plan.md`: Unit, golden, property, and integration test specifications.
   - `docs/report-outline.md`: Academic report structure for course AID20090.
   - `docs/demo-script.md`: 5-minute Minimum Viable Demo (MVD) script for faculty review.
   - `docs/risk-register.md`: Risk matrix and contingency cut-order plan.

3. **Scaffolding & Build Configuration**:
   - Created project repository layout: `engine/`, `tests/`, `benchmarks/`, `frontend/`, `scripts/`, `docs/`.
   - Setup `CMakeLists.txt` and `CMakePresets.json` with target definitions for engine library, CLI, and test harnesses.
   - Created clean `.gitignore` and `README.md`.

---

## 2. Verification & Next Steps

- All architecture contracts reviewed.
- Next Phase: **Phase 1 — Discrete-Event Clock & CPU Scheduling Engine**.
