# KernelLens 5-Minute Minimum Viable Demo (MVD) Script

This document details the exact sequence for demonstrating KernelLens to evaluation faculty in under 5 minutes.

---

## 5-Minute Walkthrough Sequence

### Minute 1: CPU Convoy Effect & Comparison (Steps 1–4)
1. **Open UI & Select Convoy Preset**:
   - Launch KernelLens in the browser (`http://localhost:5173`).
   - Select the **"Convoy Effect"** preset: Process $P_1$ (burst 24), $P_2$ (burst 3), $P_3$ (burst 3) arriving at $t=0$.
2. **Execute FCFS vs Round Robin**:
   - Run FCFS: Observe $P_1$ monopolize the CPU until $t=24$, forcing $P_2, P_3$ to experience high waiting times (avg waiting: 17.0 ticks).
   - Switch or compare side-by-side with Round Robin ($q = 3$): Observe time-slicing where $P_2, P_3$ complete by $t=9$ and $t=12$, slashing average waiting time down to 5.67 ticks.
3. **Interactive D3 Gantt Replay & Scrubbing**:
   - Hit **Play** to watch the D3 animated dispatch transitions.
   - Drag the time scrubber backward and forward across ticks; observe instantaneous state reconstruction without re-simulating.
4. **Inspect Quantitative Metrics**:
   - Open the Comparison Drawer: view exact deltas for Turnaround, Waiting, Response, Context Switches, CPU Utilization, and Jain's Fairness Index.

---

### Minute 2: Virtual Memory & Belady's Anomaly (Steps 5–6)
5. **Page Replacement on Standard Reference String**:
   - Navigate to the **Memory & Paging** tab.
   - Load reference string: `7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2, 1, 2, 0, 1, 7, 0, 1` with 3 frames.
   - Run FIFO, LRU, and Optimal side-by-side. Inspect frame residence tables and page fault timelines.
6. **Belady's Anomaly Demonstration**:
   - Click the **"Belady Anomaly"** preset: `1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5`.
   - Compare FIFO with 3 frames (9 page faults) vs 4 frames (10 page faults).
   - Note the clear anomaly badge and counter-intuitive fault increase explanation.

---

### Minute 3: Deadlock Detection & Banker's Algorithm (Step 7)
7. **Resource Allocation Graph & Banker's Safe State**:
   - Navigate to the **Synchronization & Deadlocks** tab.
   - Load the classic 5-process, 3-resource matrix ($A, B, C$).
   - Run Banker's safety check: observe generated safe execution sequence:
     $$\langle P_1, P_3, P_4, P_0, P_2 \rangle$$
   - Submit an unsafe request: Process $P_4$ requests $[3, 3, 0]$.
   - Observe engine evaluation: The request is safely DENIED with an explicit explanation showing that Available resources would drop below minimum need.
   - Switch to the RAG tab: Add a mutual wait dependency ($P_1 \to R_1 \to P_2 \to R_2 \to P_1$) and observe the interactive D3 cycle detector highlight the cycle in crimson red.

---

### Minute 4: Disk Head Route Animation (Step 8)
8. **Disk Head Traversal: SSTF vs SCAN**:
   - Navigate to the **Disk Scheduling** tab.
   - Load requests: `98, 183, 37, 122, 14, 124, 65, 67` with initial head at `53`.
   - Run SSTF: Total seek $= 236$ cylinders. Notice greedy local head movements.
   - Run SCAN: Total seek $= 208$ cylinders (or textbook equivalent based on directional boundary).
   - Watch the animated disk head route track and plot the trajectory graph in real time.

---

### Minute 5: Export, Automated Tests & Verification (Step 9)
9. **Export & Test Validation**:
   - Click **Export JSON / CSV**: Save the full normalized v1 event stream and metrics summary.
   - Switch to the terminal: Run `ctest --test-dir build --output-on-failure` or execute the test suite script.
   - Show 100% of automated unit, golden, and invariant tests passing cleanly.
