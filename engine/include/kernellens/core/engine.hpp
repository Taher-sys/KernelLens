#pragma once

#include "kernellens/core/types.hpp"
#include "kernellens/core/clock.hpp"
#include "kernellens/core/event_log.hpp"
#include "kernellens/core/metrics.hpp"
#include "kernellens/cpu/scheduler.hpp"
#include <memory>
#include <vector>
#include <string>

namespace kernellens {

struct ProcessSnapshot {
  ProcessId pid = 0;
  ProcessState state = ProcessState::New;
  std::size_t burst_index = 0;
  Tick remaining_current_burst = 0;
  Tick cpu_service = 0;
  Tick ready_wait = 0;
  Tick first_run_time = -1;
  Tick finish_time = -1;
  Tick last_ready_time = -1;
  int current_priority = 0;
};

struct EngineSnapshot {
  Tick tick = 0;
  SequenceNo seq = 0;
  std::optional<ProcessId> running_pid;
  std::vector<ProcessId> ready_pids;
  std::vector<ProcessId> terminated_pids;
  std::size_t context_switch_count = 0;
  std::vector<ProcessSnapshot> processes;

  std::string to_json() const;
  bool operator==(const EngineSnapshot& other) const;
  bool operator!=(const EngineSnapshot& other) const { return !(*this == other); }
};

struct SimulationConfig {
  std::string run_id = "run-001";
  std::uint64_t seed = 42;
  Tick context_switch_cost = 0;
  Tick max_ticks = 100000;
  bool emit_detailed_events = true;
};

class SimulationEngine {
public:
  explicit SimulationEngine(SimulationConfig config = {});

  void set_scheduler(std::unique_ptr<IScheduler> scheduler);
  void load_workload(const std::vector<ProcessSpec>& specs);

  void run();
  bool step();

  Tick current_tick() const noexcept { return clock_.now(); }
  const EventLog& event_log() const noexcept { return log_; }
  const std::vector<ProcessRuntime>& processes() const noexcept { return processes_; }
  const std::vector<ProcessId>& ready_pids() const noexcept { return ready_pids_; }
  std::optional<ProcessId> running_pid() const noexcept { return running_pid_; }
  std::size_t context_switch_count() const noexcept { return context_switch_count_; }
  const SimulationConfig& config() const noexcept { return config_; }
  const SimulationMetrics& metrics() const noexcept { return metrics_; }
  bool is_finished() const;

  // Snapshot generation for deterministic time-travel replay
  EngineSnapshot take_snapshot() const;

private:
  void schedule_arrivals();
  void try_schedule();
  void on_process_burst_finished(ProcessId pid);

  SimulationConfig config_;
  SimClock clock_;
  EventLog log_;
  std::unique_ptr<IScheduler> scheduler_;
  std::vector<ProcessRuntime> processes_;
  std::vector<ProcessId> ready_pids_;
  std::optional<ProcessId> running_pid_ = std::nullopt;
  Tick current_burst_end_tick_ = -1;
  Tick current_quantum_end_tick_ = -1;
  std::size_t context_switch_count_ = 0;
  SimulationMetrics metrics_;

  ProcessRuntime* get_process(ProcessId pid);
};

} // namespace kernellens
