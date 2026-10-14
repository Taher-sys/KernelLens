# KernelLens Risk Register & Cut-Order Contingency Plan

## 1. Risk Register

| Risk ID | Description | Severity | Likelihood | Mitigation Strategy |
|---|---|---|---|---|
| **R-01** | Toolchain friction with WebAssembly compilation on host machine | High | Medium | Provide dual-engine execution: C++ compiled to WebAssembly with fallback TypeScript engine bridge using identical event schema. |
| **R-02** | Non-deterministic simulation runs causing flaky tests or divergent replays | Critical | Low | Eliminate all `std::random_device` and wall-clock timestamps in simulation code; mandate `std::mt19937_64` with seed. Ordered event queues with sequence tie-breakers. |
| **R-03** | UI performance degradation during scrubbing of large event logs ($>10^4$ events) | Medium | Medium | Maintain periodic simulation state snapshots (e.g. every 50 events); scrub by restoring nearest snapshot and replaying delta. |
| **R-04** | Scope creep across stretch Tier 2 & Tier 3 modules jeopardizing lab deadlines | High | Medium | Strictly prioritize committed Tier 1 core algorithms and the Minimum Viable Demo (MVD) before any Tier 2/3 work. |
| **R-05** | Ambiguous metric definitions causing discrepancies against textbook values | Medium | Low | Codify all mathematical definitions in `docs/algorithm-notes.md` with explicit unit tests validating golden textbook examples. |

---

## 2. Cut-Order Contingency Plan

If time or resource constraints arise:

1. **Cut Tier 3 stretch immediately**:
   - Linux trace ingestion (`/proc` / `perf sched`).
   - Machine learning burst-time predictor.
   - Multi-core affinity and load balancing.
   - Working-set model and thrashing detector.

2. **Cut secondary Tier 2 stretch**:
   - IPC simulation (pipes, message queues, shared memory).
   - Virtual system-call interrupt and mini-instruction set.

3. **Simplify Tier 2 components**:
   - Keep in-memory inode filesystem to metadata + single block allocation before cutting core algorithms.
   - Simplify journaling crash injection to two fixed discrete points.

4. **Preserve Committed Core**:
   - **Never cut**: Tier 1 CPU, Virtual Memory, Deadlock/Banker's, and Disk Scheduling.
   - **Never cut**: D3.js animated visualizations, deterministic event logging, unit/golden tests, and the academic project report.
