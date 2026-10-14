#pragma once

#include "kernellens/core/types.hpp"
#include "kernellens/core/clock.hpp"
#include "kernellens/core/event_log.hpp"
#include "kernellens/core/metrics.hpp"
#include "kernellens/cpu/scheduler.hpp"
#include <memory>
#include <vector>

namespace kernellens {

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
  const SimulationMetrics& metrics() const noexcept { return metrics_; }
  bool is_finished() const;

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
