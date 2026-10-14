# KernelLens Comprehensive Test Plan

## 1. Objectives & Principles

The test suite ensures the absolute mathematical correctness, determinism, and robust error handling of KernelLens:
- **No untested algorithms**: Every policy must have deterministic unit tests and golden textbook fixtures.
- **Strict byte-identical determinism**: Runs with identical seed and configuration must produce identical event sequences.
- **Boundary & Malformed Inputs**: Verify graceful rejection of invalid requests (e.g. negative time quantum, non-existent PID, invalid page reference).

---

## 2. Test Pyramid & Categorization

```text
                  ▲
                 / \
                /   \     E2E UI & WebAssembly Replay (5 tests)
               /─────\
              /       \   Integration & Multi-Policy Scenarios (15 tests)
             /─────────\
            /           \ Property-Based & Invariant Validation (20 tests)
           /─────────────\
          /               \ Golden Textbook Example Verification (25 tests)
         /─────────────────\
        /                   \ Unit Tests per Policy & Component (50+ tests)
       └─────────────────────┘
```

---

## 3. Specific Test Scenarios

### 3.1 CPU Scheduling
- **FCFS Convoy Effect**:
  - $P_1$ arrives at $0$ (burst 24), $P_2$ at $1$ (burst 3), $P_3$ at $2$ (burst 3).
  - Assert $P_1$ finishes at 24, $P_2$ at 27, $P_3$ at 30.
  - Calculate average waiting time $= (0 + 23 + 25) / 3 = 16.0$.
- **SJF Non-Preemptive Ties**:
  - Multiple tasks with identical burst lengths. Assert lower arrival time, then lower PID tie-breaking.
- **SRTF Preemption**:
  - $P_1$ running with remaining burst 5; $P_2$ arrives with burst 2. Assert immediate preemption event emitted.
- **Priority Aging**:
  - Low priority process waiting $100$ ticks with aging interval $10$. Assert priority reaches $0$ and process runs.
- **Round Robin Quantum Boundaries**:
  - Quantum $= 4$. Task with burst 4 terminates at end of quantum without superfluous ready-enqueue.
  - Task with burst 5 receives 4 ticks, quantum expires, re-enqueued, receives 1 tick.
- **MLFQ Priority Boost**:
  - Process demoted to lowest queue is boosted back to $Q_0$ on boost tick $S$.
- **Jain Fairness Calculation**:
  - Equal CPU allocation gives $J = 1.0$. Highly skewed allocation yields $J \to 1/n$.

### 3.2 Virtual Memory & Paging
- **FIFO Belady's Anomaly Test**:
  - Reference string: `1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5`.
  - Frame capacity 3: Assert exactly 9 page faults.
  - Frame capacity 4: Assert exactly 10 page faults.
- **LRU Stack Property**:
  - Ensure for any reference string, fault count with $M+1$ frames $\le$ fault count with $M$ frames.
- **Optimal (MIN)**:
  - Assert theoretical minimum faults against textbook benchmark.
- **Clock Second-Chance**:
  - Verify reference bit clearing and pointer wrap-around.
- **TLB Hit/Miss**:
  - Assert TLB hit does not walk page table or emit page fault.

### 3.3 Synchronization & Deadlocks
- **Producer-Consumer Semaphore Invariants**:
  - Buffer count never exceeds buffer size.
  - Consumer blocks when buffer empty; producer blocks when buffer full.
- **RAG Cycle Detection**:
  - Single unit resources: cycle triggers deadlock alert.
  - Multi-unit resources: cycle without knot does not falsely trigger deadlock.
- **Banker's Algorithm Safety Matrix**:
  - Test classic Silberschatz 5-process, 3-resource matrix:
    - Initial state: Assert SAFE with sequence $\langle P_1, P_3, P_4, P_0, P_2 \rangle$ or valid equivalent.
    - Request $P_1 \to [1, 0, 2]$: Assert GRANTED and new safe state confirmed.
    - Request $P_4 \to [3, 3, 0]$: Assert DENIED due to unsafe state.

### 3.4 Disk Scheduling
- **Textbook 8-Request String**:
  - Requests: `98, 183, 37, 122, 14, 124, 65, 67`, initial head `53`, boundary `[0, 199]`.
  - **FCFS**: Total seek $= 640$.
  - **SSTF**: Total seek $= 236$.
  - **SCAN** (head moving toward 0 or 199): Verify exact seek distance matching standard reference.
  - **C-SCAN**: Verify return jump accounting.
  - **LOOK / C-LOOK**: Verify head turns at extreme requests without traveling to 0 or 199.

### 3.5 Dynamic Memory Allocation & Filesystem
- **Allocation Policies**:
  - Memory: 100K, 500K, 200K, 300K, 600K free holes.
  - Process requests: 212K, 417K, 112K, 426K.
  - Assert First-fit, Best-fit, Worst-fit outcomes.
- **Filesystem WAL & Crash Recovery**:
  - Inject crash during uncommitted inode allocation: transaction rolled back.
  - Inject crash after commit log written: redo transaction applied on reboot.
