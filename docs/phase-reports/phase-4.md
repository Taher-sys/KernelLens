# Phase 4 Report — Synchronization & Deadlock Detection

**Course:** Operating Systems Lab (AID20090), Third Year CSE / AI-DS, Semester V, 2026-27
**Project:** KernelLens — Deterministic Discrete-Event OS Simulation Laboratory
**Document:** `docs/phase-reports/phase-4.md`
**Status:** Complete — Semaphores, mutex, RAG cycle detection, and Banker's Algorithm implemented and tested

---

## 1. Implementation Summary

Phase 4 implements synchronization primitives and deadlock detection mechanisms as deterministic discrete-event simulations. All actors are logical entities driven by the simulation clock—no native threads or nondeterministic constructs.

### Deliverables

| Component | Path | Status |
|-----------|------|--------|
| Semaphore & Mutex | `engine/include/kernellens/sync/semaphore.hpp`, `engine/src/sync/semaphore.cpp` | Complete |
| Resource Allocation Graph | `engine/include/kernellens/sync/resource_graph.hpp`, `engine/src/sync/resource_graph.cpp` | Complete |
| Banker's Algorithm | `engine/include/kernellens/sync/banker.hpp`, `engine/src/sync/banker.cpp` | Complete |
| Golden tests | `tests/golden/test_golden_sync.cpp` | Complete |
| Unit tests | `tests/unit/test_sync.cpp` | Complete |

---

## 2. Semaphore Implementation

**File:** `engine/include/kernellens/sync/semaphore.hpp`

### Interface

```cpp
class SimSemaphore {
public:
  SimSemaphore(std::string id, int initial_value, EventLog* log = nullptr);

  const std::string& id() const noexcept;
  int value() const noexcept;
  const std::deque<ProcessId>& wait_queue() const noexcept;

  bool wait(ProcessId pid, Tick now);              // Returns false if blocked
  std::optional<ProcessId> signal(Tick now);       // Returns unblocked PID if any
  void reset(int initial_value);
};
```

### Wait Semantics

```cpp
bool wait(ProcessId pid, Tick now) {
  if (value_ > 0) {
    value_--;
    log_->emit("sync", "lock_acquired", pid, now, ...);
    return true;  // Success, no blocking
  } else {
    value_--;
    wait_queue_.push_back(pid);
    log_->emit("sync", "lock_blocked", pid, now, ...);
    return false;  // Process blocked
  }
}
```

### Signal Semantics

```cpp
std::optional<ProcessId> signal(Tick now) {
  value_++;
  if (!wait_queue_.empty()) {
    ProcessId pid = wait_queue_.front();
    wait_queue_.pop_front();
    log_->emit("sync", "lock_released", pid, now, ...);
    return pid;  // Wake blocked process
  }
  return std::nullopt;
}
```

### Deterministic Model

- Semaphore value can go negative: `value < 0` indicates `|value|` processes blocked
- Wait queue is FIFO (`std::deque`) ensuring deterministic wake order
- No actual thread blocking—returns boolean indicating logical state

---

## 3. Mutex Implementation

**File:** `engine/include/kernellens/sync/semaphore.hpp`

### Interface

```cpp
class SimMutex {
public:
  explicit SimMutex(std::string id, EventLog* log = nullptr);

  const std::string& id() const noexcept;
  bool is_locked() const noexcept;
  std::optional<ProcessId> owner() const noexcept;

  bool lock(ProcessId pid, Tick now);
  std::optional<ProcessId> unlock(ProcessId pid, Tick now);
  void reset();
};
```

### Design

- Built on `SimSemaphore` with initial value 1
- Tracks `owner_` for ownership verification
- Unlock automatically transfers ownership to next waiting process

### Ownership Transfer

```cpp
// P1 holds mutex, P2 is blocked
auto next = mutex.unlock(1, now);  // P1 releases
// next == 2, P2 now owns the mutex
```

---

## 4. Resource Allocation Graph (RAG)

**File:** `engine/include/kernellens/sync/resource_graph.hpp`

### Interface

```cpp
class ResourceAllocationGraph {
public:
  explicit ResourceAllocationGraph(EventLog* log = nullptr);

  void add_process(const std::string& process_id);
  void add_resource(const std::string& resource_id, int instances = 1);

  void add_request_edge(const std::string& process_id,
                         const std::string& resource_id, Tick now = 0);
  void remove_request_edge(const std::string& process_id,
                            const std::string& resource_id, Tick now = 0);

  void add_assignment_edge(const std::string& resource_id,
                            const std::string& process_id, Tick now = 0);
  void remove_assignment_edge(const std::string& resource_id,
                               const std::string& process_id, Tick now = 0);

  RAGCycleReport detect_deadlock(Tick now = 0) const;
  void clear();
};
```

### Graph Structure

Bipartite graph with two node types:
- **Process nodes (P)**: Represent active processes
- **Resource nodes (R)**: Represent resource types

**Edge types:**
- Request edge: P → R (process requests resource)
- Assignment edge: R → P (resource held by process)

### Cycle Detection Algorithm

DFS-based cycle detection in `detect_deadlock()`:

```cpp
void dfs_find_cycles(const std::string& start, const std::string& current,
                     std::vector<std::string>& path,
                     std::set<std::string>& visited,
                     std::vector<std::vector<std::string>>& found_cycles) const;
```

- Starts DFS from each process node
- Detects cycles where path returns to start node
- Minimum cycle length: 3 (P → R → P)
- Deduplicates cycles before reporting

### Deadlock Condition

A cycle in the RAG indicates potential deadlock:
- Each process in cycle holds a resource needed by the next process
- No process can proceed without releasing, but release requires proceeding
- Result: circular wait → deadlock

---

## 5. Banker's Algorithm

**File:** `engine/include/kernellens/sync/banker.hpp`

### Data Structures

```cpp
class BankersAlgorithm {
private:
  std::size_t num_processes_;
  std::size_t num_resources_;
  std::vector<int> available_;                      // Available[m]: free instances of resource m
  std::vector<std::vector<int>> max_;               // Max[n][m]: max claim of process n for resource m
  std::vector<std::vector<int>> allocation_;        // Allocation[n][m]: current allocation
  // Need[n][m] = Max[n][m] - Allocation[n][m]
};
```

### Safety Algorithm

```cpp
BankerSafetyReport check_safety() const;
```

**Algorithm:**
1. Initialize `Work = Available`, `Finish[i] = false` for all i
2. Find i such that `Finish[i] = false` and `Need[i] ≤ Work`
3. If found: `Work += Allocation[i]`, `Finish[i] = true`, goto step 2
4. If all `Finish[i] = true`: SAFE, else UNSAFE

**Output:** Safe sequence if exists, or UNSAFE state

### Resource Request Algorithm

```cpp
BankerRequestResult request_resources(ProcessId pid,
                                       const std::vector<int>& request,
                                       Tick now = 0);
```

**Algorithm:**
1. Check `Request ≤ Need` (else: exceeds maximum claim → DENY)
2. Check `Request ≤ Available` (else: not available → WAIT)
3. **Speculative allocation:**
   - `Available -= Request`
   - `Allocation[pid] += Request`
4. Check safety of resulting state
5. If SAFE: grant request
6. If UNSAFE: rollback speculative allocation, deny request

### Critical Property

A request that would leave the system in an unsafe state is **never granted**. This guarantees deadlock avoidance.

---

## 6. Event Emission

| Event Type | Subsystem | When Emitted |
|------------|-----------|--------------|
| `lock_acquired` | sync | Semaphore/mutex acquisition succeeds |
| `lock_blocked` | sync | Process must wait (semaphore value ≤ 0) |
| `lock_released` | sync | Semaphore signal or mutex unlock |
| `rag_edge_added` | sync | Request or assignment edge added |
| `rag_edge_removed` | sync | Edge removed from graph |
| `deadlock_detected` | sync | Cycle found in RAG |
| `banker_request_granted` | sync | Request approved (safe state) |
| `banker_request_denied` | sync | Request denied (unsafe or unavailable) |

---

## 7. Test Results

### Golden Tests (`tests/golden/test_golden_sync.cpp`)

| Test | Description | Verification | Status |
|------|-------------|--------------|--------|
| `Golden_BankersAlgorithm_Silberschatz` | Silberschatz textbook example | Safe sequence verified, P1 request granted, P4/P0 denied | PASS |
| `Golden_RAG_DeadlockDetection` | Mutual dependency cycle | Cycle detected, removal breaks deadlock | PASS |

#### Silberschatz Example Details

5 processes, 3 resource types (A, B, C):
- Available: [3, 3, 2]
- Initial state: SAFE with sequence `<P1, P3, P4, P0, P2>`
- P1 requests [1, 0, 2]: **GRANTED** (safe)
- P4 requests [3, 3, 0]: **DENIED** (exceeds available)
- P0 requests [0, 2, 0]: **DENIED** (would leave unsafe state)

### Unit Tests (`tests/unit/test_sync.cpp`)

| Test | Description | Status |
|------|-------------|--------|
| `Sync_SemaphoreCounting` | Counting semaphore with value=2, blocking on 3rd wait | PASS |
| `Sync_MutexOwnership` | Mutex ownership transfer on unlock | PASS |

### Execution Output

```
Running test: Golden_BankersAlgorithm_Silberschatz...
 [PASS] Golden_BankersAlgorithm_Silberschatz
Running test: Golden_RAG_DeadlockDetection...
 [PASS] Golden_RAG_DeadlockDetection
Running test: Sync_SemaphoreCounting...
 [PASS] Sync_SemaphoreCounting
Running test: Sync_MutexOwnership...
 [PASS] Sync_MutexOwnership
```

---

## 8. Complexity Analysis

| Operation | Time | Space |
|-----------|------|-------|
| `SimSemaphore::wait()` | O(1) | O(N) queue |
| `SimSemaphore::signal()` | O(1) | - |
| `SimMutex::lock()` | O(1) | O(N) queue |
| `SimMutex::unlock()` | O(1) | - |
| RAG::add_edge() | O(1) | O(V + E) |
| RAG::detect_deadlock() | O(V + E) | O(V) DFS stack |
| Banker::check_safety() | O(P² × R) | O(P × R) |
| Banker::request_resources() | O(P² × R) | O(P × R) |

Where:
- N = number of waiting processes
- V = vertices in RAG (processes + resources)
- E = edges in RAG
- P = number of processes
- R = number of resource types

---

## 9. Determinism Model

All synchronization primitives operate on logical simulation time:
- No `std::mutex`, `std::condition_variable`, or native threads
- Blocking modeled as return value + queue insertion
- Wake order is FIFO (deterministic)
- All state transitions emit events for replay

### Example: Producer-Consumer Pattern

```cpp
SimSemaphore empty("empty", N);  // N slots available
SimSemaphore full("full", 0);    // 0 items ready
SimMutex mutex("buffer");

// Producer
empty.wait(producer_pid, now);
mutex.lock(producer_pid, now);
// ... produce item ...
mutex.unlock(producer_pid, now);
full.signal(now);

// Consumer
full.wait(consumer_pid, now);
mutex.lock(consumer_pid, now);
// ... consume item ...
mutex.unlock(consumer_pid, now);
empty.signal(now);
```

All operations deterministic given same process IDs and timing.

---

## 10. CLI Integration

```
.\build\bin\kernellens.exe --module sync --policy BANKER
.\build\bin\kernellens.exe --module sync --policy RAG
```

Output shows safety analysis and deadlock detection results.

---

## 11. Acceptance Criteria Verification

| Criterion | Requirement | Status |
|-----------|-------------|--------|
| Semaphore/mutex | Acquire/release/block semantics | ✓ Complete |
| Deterministic actors | No native threads, simulation clock driven | ✓ Verified |
| RAG cycle detection | DFS-based, finds cycles | ✓ Complete |
| Banker's safety check | Returns safe sequence or UNSAFE | ✓ Verified |
| Banker's request handling | Grants only if safe, denies unsafe | ✓ Verified |
| Unsafe request denial | Request → unsafe state never granted | ✓ Tested |
| Event emission | All required events emitted | ✓ Complete |
| Golden tests | Textbook examples verified | ✓ PASS |

---

## 12. Dependencies

- Phase 1: Core clock, event log
- Phase 0: Architecture specification, event schema

---

## 13. Next Phase

Phase 5: Disk Scheduling
- 6 disk scheduling policies (FCFS, SSTF, SCAN, C-SCAN, LOOK, C-LOOK)
- Head position tracking
- Seek distance calculation
