# KernelLens — AI Agents & Team Collaboration Protocol

## Operating Principles

1. **Deterministic C++17 Engine as Source of Truth**:
   - The simulation engine in C++17 is the definitive source of truth for all operating system algorithms, events, and metrics.
   - Algorithms must NEVER be reimplemented or duplicated in TypeScript.
   - The React frontend acts as a pure visualization and replay consumer of the engine's event stream.

2. **One Writer Per File**:
   - Multiple agents must never edit the same file simultaneously.
   - Role boundaries:
     - **Claude Code**: C++ algorithms, core data structures, and unit/golden tests.
     - **Antigravity**: Project scaffolding, build pipelines, CMake, integration, and browser testing.
     - **Gemini**: Frontend UI/UX, D3.js animated visualizations, and focused critique.

3. **Verifiable Testing Protocol**:
   - No agent may claim tests passed unless it actually executed the commands and reported the exact outputs.
   - Every phase ends with passing automated tests, a phase report in `docs/phase-reports/`, a git review, and working demo steps.

4. **Discrete Time & Seeded Determinism**:
   - Time is represented strictly as integer ticks (`int64_t`).
   - Events are totally ordered by `(event_time, event_priority, insertion_sequence)`.
   - Pseudo-random generation uses explicit PRNGs (`std::mt19937_64`) initialized with a user-provided seed. Never use `std::random_device` inside simulation loops.
   - Wall-clock timestamps belong only in benchmark metadata, never in simulation event payloads.

5. **Single Event Stream Contract**:
   - State mutations emit normalized, versioned events (`schemaVersion: 1`).
   - The UI scrubs backward and forward strictly via event log replay and snapshot states.
