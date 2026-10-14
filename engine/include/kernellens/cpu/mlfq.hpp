#pragma once

#include "kernellens/cpu/scheduler.hpp"
#include <vector>
#include <deque>

namespace kernellens {

struct MlfqLevelConfig {
  Tick quantum = 2;
};

class MlfqScheduler : public IScheduler {
public:
  explicit MlfqScheduler(std::vector<Tick> quanta = {2, 4, 8}, Tick boost_interval = 50);

  std::string name() const override { return "MLFQ"; }

  void on_ready(ProcessId pid, Tick now, const SchedulerContext& ctx) override;
  std::optional<ProcessId> select_next(const SchedulerContext& ctx) override;
  bool should_preempt(const SchedulerContext& ctx) override;
  std::optional<Tick> time_slice(ProcessId pid, const SchedulerContext& ctx) const override;
  void on_dispatch(ProcessId pid, Tick now, const SchedulerContext& ctx) override;
  void on_quantum_expired(ProcessId pid, Tick now, const SchedulerContext& ctx) override;
  void on_cpu_burst_completed(ProcessId pid, Tick now, const SchedulerContext& ctx) override;
  void reset() override;

  int get_process_level(ProcessId pid) const;
  void perform_priority_boost(Tick now);

private:
  std::vector<Tick> quanta_;
  Tick boost_interval_ = 50;
  Tick last_boost_time_ = 0;
  std::vector<std::deque<ProcessId>> queues_;
  std::vector<std::pair<ProcessId, int>> process_levels_;

  int find_or_create_level(ProcessId pid);
};

} // namespace kernellens
