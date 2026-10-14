# KernelLens Algorithmic Complexity Reference

This document formalizes the theoretical time and space complexity of every data structure and scheduling algorithm implemented in KernelLens.

## 1. Simulation Engine Core

| Component | Operation | Time Complexity | Space Complexity | Notes |
|---|---|---|---|---|
| Discrete Event Queue | Schedule Event | $O(\log E)$ | $O(E)$ | `std::priority_queue` with $E$ pending events |
| Discrete Event Queue | Pop Next Event | $O(\log E)$ | $O(E)$ | Min-heap ordered by `(time, prio, seq)` |
| Event Log | Emit SimEvent | $O(1)$ amortized | $O(N)$ | Monotonic vector of $N$ recorded events |
| Event Log | Replay / Snapshot | $O(N)$ | $O(N / K)$ | Snapshots every $K$ events for $O(K)$ jump |

---

## 2. CPU Scheduling Policies

Let $N$ be the number of active processes in the ready queue.

| Policy | Enqueue (`on_ready`) | Selection (`select_next`) | Preemption Check | Space Complexity |
|---|---|---|---|---|
| **FCFS** | $O(1)$ | $O(1)$ | $O(1)$ (False) | $O(N)$ (FIFO queue) |
| **SJF (Non-Preemptive)** | $O(\log N)$ | $O(\log N)$ | $O(1)$ (False) | $O(N)$ (Min-heap by burst) |
| **SRTF (Preemptive)** | $O(\log N)$ | $O(\log N)$ | $O(1)$ | $O(N)$ (Min-heap by remaining) |
| **Priority** | $O(\log N)$ | $O(\log N)$ | $O(1)$ | $O(N)$ (Priority queue) |
| **Priority + Aging** | $O(N)$ or $O(\log N)$ | $O(1)$ | $O(1)$ | $O(N)$ (Linear scan or aged queues) |
| **Round Robin** | $O(1)$ | $O(1)$ | $O(1)$ | $O(N)$ (Circular ring / FIFO) |
| **MLFQ** ($K$ levels) | $O(1)$ | $O(K)$ | $O(K)$ | $O(N + K)$ ($K$ FIFO queues) |
| **CFS-Like** | $O(\log N)$ | $O(1)$ | $O(\log N)$ | $O(N)$ (Red-Black tree / `std::set`) |

---

## 3. Virtual Memory & Page Replacement

Let $M$ be the number of allocated physical frames, and $L$ be the reference string length.

| Policy | Page Access (Hit) | Choose Victim (Fault) | Space Complexity | Notes |
|---|---|---|---|---|
| **FIFO** | $O(1)$ | $O(1)$ | $O(M)$ | Queue of frame pointers |
| **LRU** | $O(1)$ | $O(M)$ or $O(1)$ | $O(M)$ | Timestamp scan or doubly linked hash list |
| **Optimal (MIN)** | $O(1)$ | $O(M \cdot L)$ | $O(M + L)$ | Lookahead scan over future references |
| **Clock (2nd Chance)** | $O(1)$ | $O(M)$ worst-case | $O(M)$ | Circular buffer with reference bits |
| **TLB Lookups** | $O(T)$ | $O(1)$ | $O(T)$ | Associative array of size $T \ll M$ |

---

## 4. Synchronization & Deadlock Detection

Let $P$ be the number of processes, and $R$ be the number of distinct resource types.

| Algorithm | Operation | Time Complexity | Space Complexity | Notes |
|---|---|---|---|---|
| **Semaphore** | `wait()` / `signal()` | $O(1)$ | $O(P)$ | Counter + FIFO blocked wait queue |
| **RAG Cycle Detection** | Find Cycles | $O(P + R + E)$ | $O(P + R + E)$ | Tarjan's SCC / DFS on bipartite graph |
| **Banker's Algorithm** | Safety Check | $O(P^2 \times R)$ | $O(P \times R)$ | Classical vector/matrix safety validation |
| **Banker's Algorithm** | Request Evaluation | $O(P^2 \times R)$ | $O(P \times R)$ | Speculative allocation + safety check |

---

## 5. Disk Scheduling

Let $K$ be the number of pending disk cylinder requests in the queue.

| Policy | Enqueue Request | Select Next Route | Total Traversal Time | Space Complexity |
|---|---|---|---|---|
| **FCFS** | $O(1)$ | $O(1)$ | $O(K)$ | $O(K)$ FIFO queue |
| **SSTF** | $O(1)$ or $O(\log K)$ | $O(K)$ | $O(K^2)$ greedy | $O(K)$ array / tree |
| **SCAN** | $O(\log K)$ | $O(1)$ | $O(K \log K)$ | $O(K)$ sorted set |
| **C-SCAN** | $O(\log K)$ | $O(1)$ | $O(K \log K)$ | $O(K)$ sorted set |
| **LOOK** | $O(\log K)$ | $O(1)$ | $O(K \log K)$ | $O(K)$ sorted set |
| **C-LOOK** | $O(\log K)$ | $O(1)$ | $O(K \log K)$ | $O(K)$ sorted set |

---

## 6. Tier 2: Dynamic Memory Allocation & Filesystem

| Component | Operation | Time Complexity | Space Complexity | Notes |
|---|---|---|---|---|
| **First-Fit** | Allocate $B$ bytes | $O(F)$ | $O(F)$ | Linear scan through $F$ free blocks |
| **Best-Fit** | Allocate $B$ bytes | $O(F)$ or $O(\log F)$ | $O(F)$ | Min-heap or ordered tree of block sizes |
| **Worst-Fit** | Allocate $B$ bytes | $O(F)$ or $O(\log F)$ | $O(F)$ | Max-heap of block sizes |
| **Deallocate & Coalesce** | Free block | $O(1)$ or $O(\log F)$ | $O(F)$ | Boundary tag coalesce with neighbors |
| **Inode Lookup** | Path resolution | $O(D \cdot \log B)$ | $O(I)$ | $D$ directory components |
| **WAL Journaling** | Commit transaction | $O(T)$ | $O(T)$ | Sequential append to journal log |
