# KernelLens Architecture Decision Records (ADRs)

Architecture Decision Records capturing the four foundational design choices for KernelLens.

---

## ADR-01: Native-First Execution with Optional WebAssembly Bridge

**Status:** Accepted  
**Date:** 2026-10-14  
**Deciders:** Engine team

### Context

KernelLens must deliver deterministic discrete-event simulations both as an offline CLI tool (for CI, testing, and direct faculty evaluation) and as a browser-embedded interactive laboratory (for live students without server infrastructure). Two competing approaches exist:
- A pure-WASM architecture where all simulation logic lives in the browser.
- A native-first architecture where the C++17 binary is the canonical engine and WASM is a secondary compilation target.

### Decision

**Native C++17 binary is the primary execution target.** The CMake build produces a fully functional static library (`kernellens_engine`) and CLI executable (`kernellens`) with zero browser dependencies. Emscripten/WASM compilation is a separate build target that consumes the same C++ sources.

The frontend communicates with the engine through a typed `EngineBridge` abstraction whose interface does not change between the native JSON-over-pipe path and the WASM-in-Web-Worker path.

### Consequences

**Positive:**
- C++ compilation errors and test failures are caught in the CI pipeline before any browser integration work.
- `ctest --test-dir build` is always authoritative; no Selenium or browser headless runners required for core correctness.
- Debugging with GDB/Valgrind/ASAN is straightforward on the native build.
- The WASM target benefits from all unit tests having already passed.

**Negative:**
- Maintaining two build paths (CMake + Emscripten) adds toolchain setup complexity (mitigated by `scripts/build-native.ps1` and `CMakePresets.json`).
- Potential drift if WASM-specific flags diverge; mitigated by enforcing shared source files with zero platform-specific code in simulation logic.

**Alternatives Rejected:**
- *Pure TypeScript re-implementation*: Rejected because it violates the single-source-of-truth principle and risks metric divergence.
- *Pure WASM without CLI*: Rejected because it makes CI testing dependent on a browser runtime.

---

## ADR-02: D3.js as the Mandatory Visualization Library

**Status:** Accepted  
**Date:** 2026-10-14  
**Deciders:** Frontend team

### Context

An educational OS lab that teaches scheduling, paging, and deadlocks derives its pedagogical value from animated, step-by-step visualizations. Candidates for the rendering layer include:

- **D3.js (v7)**: Low-level SVG/Canvas with full control over element binding, data-join transitions, and custom animated layouts.
- **Recharts / Chart.js**: Higher-level charting libraries built on React and Canvas/SVG respectively.
- **Three.js**: 3D rendering — irrelevant for 2D OS diagrams.
- **CSS-only animations**: Limited to predefined shapes; cannot express dynamic data joins.

### Decision

**D3.js v7 is mandatory and non-substitutable** for all six core visualizations:

| Visualization | D3 Mechanism |
|---|---|
| CPU Gantt chart with animated playhead | `d3.scaleLinear`, `d3.scaleBand`, SVG `<rect>` transitions |
| Memory frame residence grid | SVG data join with enter/exit transitions |
| Resource Allocation Graph (RAG) | `d3.forceSimulation` node-link layout |
| Disk head trajectory plot | `d3.line`, animated `<circle>` on path |
| TLB hit/miss timeline | Horizontally scrolling SVG lanes |
| Multi-policy comparison bar chart | `d3.scaleBand` grouped bars |

Recharts or Chart.js may be used for purely static summary tables; they must not replace any of the six D3 visualizations above.

### Consequences

**Positive:**
- Full control over animation timing (frame-accurate scrubbing tied to discrete simulation ticks).
- Data joins enable efficient enter/update/exit lifecycle rather than full re-renders.
- No dependency on a third-party charting library's event model.

**Negative:**
- Steeper learning curve than Recharts for team members new to D3.
- More verbose code for simple bar charts; acceptable trade-off given the animated requirements.

**Alternatives Rejected:**
- *Recharts*: No native support for arbitrary SVG overlays or per-frame animation control.
- *Chart.js*: Canvas-based; poor composability with React's reconciler for interactive scrubbing.

---

## ADR-03: Event Replay via Immutable Event Log with Periodic Snapshots

**Status:** Accepted  
**Date:** 2026-10-14  
**Deciders:** Engine and frontend teams

### Context

The KernelLens UI requires time-travel scrubbing: a user drags a playhead to any point $T$ in the simulation timeline and the entire visualization state must reflect exactly what the engine produced at that tick. Three architectural patterns exist:

1. **Full replay from tick 0**: Simplest to implement; $O(N)$ replay cost for every scrub.
2. **Full state snapshots at every tick**: $O(1)$ lookup; $O(N \cdot S)$ storage where $S$ = state size.
3. **Periodic snapshots + delta replay**: Snapshot every $K$ events; scrub cost $O(K)$; storage $O(N/K \cdot S)$.

### Decision

**Periodic snapshot + forward delta replay, with $K = 50$ as the default interval.**

The engine emits events into an `EventLog`. After every $K$-th event the UI (or the engine in CLI replay mode) captures a full serialized state snapshot. Scrubbing to time $T$:
1. Binary search for the snapshot with the largest `seq` ≤ target seq(T).
2. Re-apply events from that snapshot forward until `event.time >= T`.

The `EventLog` exposes `to_json()` (batch) and `to_ndjson()` (streaming) to support both CLI piping and progressive browser loading.

### Consequences

**Positive:**
- Scrub latency is bounded by replaying at most $K = 50$ events regardless of total run length.
- Storage overhead is proportional to $\lceil N/K \rceil$ snapshots, not $N$.
- The event log is an immutable append-only sequence; no synchronization issues.
- Forward-only replay preserves determinism: snapshot + events is sufficient to reconstruct state.

**Negative:**
- Backward scrub requires replay from the nearest snapshot, not true O(1) rewind.
- Snapshot capture adds a small serialization cost every 50 events; acceptable at typical simulation scales ($10^3$–$10^4$ events).

**Alternatives Rejected:**
- *Full replay from zero*: Unacceptable scrub latency for runs exceeding ~1 000 events.
- *Full snapshot per event*: Memory cost prohibitive for $>10^4$ events at typical state sizes.

---

## ADR-04: Explicit Seeded PRNG for Deterministic Workload Generation

**Status:** Accepted  
**Date:** 2026-10-14  
**Deciders:** Engine team

### Context

KernelLens workload generators produce random process burst times, arrival times, and memory reference strings. Automated tests and reproducible demos both depend on **byte-identical outputs** across any two executions with the same configuration. Sources of non-determinism that must be eliminated:

- `std::random_device` — hardware entropy source; produces different values per invocation.
- `rand()` / `srand()` — implementation-defined; not reproducible across compilers or platforms.
- Wall-clock timestamps embedded in events — inherently non-deterministic.
- Hash map iteration order — unspecified in C++17.

### Decision

**All pseudo-random numbers used in simulation logic are drawn from `std::mt19937_64` initialized from an explicit integer seed supplied by the caller.** The seed is carried in the `SimulationConfig` struct and logged in the run's `runId`.

Rules enforced by code review and static analysis:
1. `std::random_device` is **prohibited** inside any simulation namespace.
2. A single `std::mt19937_64 rng{seed}` is constructed once per simulation run and shared (never re-seeded mid-run).
3. Wall-clock `std::chrono` timestamps appear **only** in benchmark metadata structs, never in `SimEvent` payloads.
4. Ordered containers (`std::map`, `std::set`) are used in preference to `std::unordered_map` / `std::unordered_set` wherever iteration order affects simulation logic.
5. Event queue tie-breaking uses `insertion_seq` counter, not pointer address comparison.

### Consequences

**Positive:**
- Identical `(seed, workload, algorithm, params)` → byte-identical NDJSON event log on any C++17 platform.
- Flaky test suites caused by randomized workloads are eliminated.
- Faculty demos are fully reproducible.
- Browser WASM runs match native CLI runs exactly (excluding wall-clock benchmark fields).

**Negative:**
- Developers must explicitly pass seeds; there is no "random" convenience shortcut in the simulation API.
- Seeded streams must not be shared across concurrent subsystems (currently moot — simulation runs are single-threaded by design).

**Alternatives Rejected:**
- *`std::random_device` with a logged seed*: The seed can be reproduced but the implementation diverges across platforms; WASM's device gives different bits than Linux's `/dev/urandom`.
- *Fixed hardcoded seed*: Allows reproduction but prevents testing multiple workload distributions without code changes; user-supplied seed is strictly better.
