# KernelLens Algorithm Specifications & Mathematical Notes

## 1. CPU Scheduling Algorithms

### 1.1 First-Come, First-Served (FCFS)
- **Policy**: Non-preemptive.
- **Queueing**: FIFO based on arrival time.
- **Tie-Breaking**: Lower PID has precedence if arrival times are identical.
- **Vulnerability**: Convoy Effect (short tasks stall behind long CPU-bound tasks).

### 1.2 Shortest Job First (SJF - Non-Preemptive)
- **Policy**: Non-preemptive. Once scheduled, a CPU burst runs to completion.
- **Queueing**: Minimum current CPU burst duration.
- **Tie-Breaking**: Earliest arrival time, then lowest PID.
- **Optimality**: Provably minimizes average waiting time for non-preemptive batches.

### 1.3 Shortest Remaining Time First (SRTF - Preemptive)
- **Policy**: Preemptive.
- **Trigger**: Upon arrival of a new process or completion of an I/O burst.
- **Rule**: If the remaining CPU burst of an incoming process is strictly less than the currently running process's remaining burst, preemption occurs:
  $$\text{Preempt if } R(P_{\text{new}}) < R(P_{\text{running}})$$
- **Tie-breaking**: Current running process retains CPU if remaining times are equal.

### 1.4 Priority Scheduling (Preemptive & Non-Preemptive)
- **Priority Convention**: Lower integer value indicates higher priority (e.g., $0$ is highest).
- **Aging Mechanism**:
  To prevent starvation of low-priority tasks:
  $$P_{\text{effective}}(t) = P_{\text{base}} - \left\lfloor \frac{t - t_{\text{ready}}}{\alpha} \right\rfloor$$
  where $\alpha$ is the configurable aging tick interval.
- **Preemptive Mode**: Preempts current process if an arriving process has higher priority.

### 1.5 Round Robin (RR)
- **Policy**: Preemptive time-slicing.
- **Quantum ($q$)**: Process receives at most $q$ ticks before quantum expiration.
- **Queue Insertion on Expiration**: Re-enqueued at the tail of the ready queue.
- **Context Switch Penalty**: Configurable context switch overhead $c \ge 0$ ticks incurred on process handoff.

### 1.6 Multi-Level Feedback Queue (MLFQ)
- **Queues**: $K$ priority queues ($Q_0, Q_1, \dots, Q_{K-1}$) with increasing time quanta ($q_0 < q_1 < \dots$).
- **Rules**:
  1. If $\text{Priority}(A) > \text{Priority}(B)$, $A$ runs.
  2. If $\text{Priority}(A) == \text{Priority}(B)$, Round Robin with $q_i$.
  3. New processes enter $Q_0$.
  4. Once a process exhausts its time allotment at priority level $i$ without blocking for I/O, it is demoted to $Q_{i+1}$.
  5. **Periodic Boost**: Every $S$ ticks, all processes in the system are boosted back to $Q_0$ to prevent starvation.

### 1.7 CFS-Like Virtual Runtime Scheduler (Educational Model)
- **Virtual Runtime ($vruntime$)**:
  $$vruntime \mathrel{+}= \Delta \text{exec\_time} \times \frac{w_0}{w_i}$$
  where $w_0 = 1024$ (nice 0 weight) and $w_i$ is mapped from nice level $[-20, 19]$.
- **Selection**: Picks the process with minimum $vruntime$ (min-heap / red-black tree model).

---

## 2. Virtual Memory & Page Replacement

### 2.1 FIFO
- Maintains a FIFO queue of loaded frames. Evicts the frame loaded earliest.
- Exhibits **Belady's Anomaly** on reference string `[1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5]`:
  - 3 frames: 9 page faults.
  - 4 frames: 10 page faults.

### 2.2 LRU (Least Recently Used)
- Evicts the frame whose page was accessed furthest in the past:
  $$\text{Victim} = \arg\min_{f \in \text{Frames}} \text{last\_access\_time}(f)$$
- Stack algorithm: Never exhibits Belady's Anomaly.

### 2.3 Optimal (MIN / Belady's Optimal)
- Inspects the future reference string and evicts the page that will not be used for the longest period of time (or never again).
- Provides theoretical lower bound on page faults.

### 2.4 Clock (Second-Chance)
- Circular list of frames with a moving pointer and a single reference bit ($R \in \{0, 1\}$).
- On access: $R \leftarrow 1$.
- On page fault:
  - If $R == 1$, clear $R \leftarrow 0$, advance hand.
  - If $R == 0$, select frame as victim, advance hand, stop.

---

## 3. Synchronization & Deadlocks

### 3.1 Logical Semaphores
- Value $S \in \mathbb{Z}$:
  - `wait(S)`: $S \leftarrow S - 1$. If $S < 0$, process blocks in FIFO semaphore wait queue.
  - `signal(S)`: $S \leftarrow S + 1$. If $S \le 0$, wake one process from wait queue to READY.

### 3.2 Resource Allocation Graph (RAG)
- Bipartite directed graph $G = (V, E)$ where $V = P \cup R$.
  - Request edge: $P_i \to R_j$ (process requests instance of resource).
  - Assignment edge: $R_j \to P_i$ (resource instance assigned to process).
- Cycle detection via Tarjan's SCC / DFS. In single-unit resource systems, a cycle is necessary and sufficient for deadlock.

### 3.3 Banker's Algorithm
- Vectors: Available $A \in \mathbb{N}^m$.
- Matrices: Max $M \in \mathbb{N}^{n \times m}$, Allocation $C \in \mathbb{N}^{n \times m}$, Need $N = M - C$.
- **Safety Algorithm**:
  1. Let $\text{Work} = A$ and $\text{Finish}[i] = \text{false}$ for all $i$.
  2. Find $i$ such that $\text{Finish}[i] == \text{false}$ and $N_i \le \text{Work}$. If none exists, goto 4.
  3. $\text{Work} = \text{Work} + C_i$, $\text{Finish}[i] = \text{true}$, record in safe sequence, goto 2.
  4. If all $\text{Finish}[i] == \text{true}$, system is SAFE; else UNSAFE.

---

## 4. Disk Head Scheduling

Given cylinder range $[0, C_{\max}]$, initial head position $H_0$, and requests $\{r_1, \dots, r_k\}$:
- **FCFS**: Services requests strictly in arrival order.
- **SSTF**: Greedily chooses $r = \arg\min |r_i - H|$. Can cause starvation at cylinder extremes.
- **SCAN (Elevator)**: Moves in current direction servicing requests until boundary $0$ or $C_{\max}$, then reverses.
- **C-SCAN**: Moves in one direction servicing requests; upon boundary, jumps directly to opposite boundary without servicing requests on return.
- **LOOK**: Like SCAN, but only travels as far as the furthest request in the current direction before reversing.
- **C-LOOK**: Like C-SCAN, but only travels as far as the last request in current direction before jumping to lowest request.

Seek Distance Calculation:
$$\text{Total Seek} = \sum_{j=1}^m |H_j - H_{j-1}|$$

---

## 5. Metrics Formalism

1. **Turnaround Time**:
   $$T_{\text{turnaround}} = t_{\text{finish}} - t_{\text{arrival}}$$
2. **Response Time**:
   $$T_{\text{response}} = t_{\text{first\_dispatch}} - t_{\text{arrival}}$$
3. **Waiting Time**:
   $$T_{\text{wait}} = \sum \Delta t_{\text{ready}}$$
   *(Accumulated ticks spent strictly in READY state)*.
4. **Jain's Fairness Index**:
   For a set of $n$ comparable processes active over window $W$, where $x_i$ is CPU ticks allocated:
   $$J(x_1, \dots, x_n) = \frac{\left(\sum_{i=1}^n x_i\right)^2}{n \cdot \sum_{i=1}^n x_i^2} \in [1/n, 1.0]$$
