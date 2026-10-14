#pragma once

#include "kernellens/cpu/scheduler.hpp"
#include <vector>

namespace kernellens {

class CfsLikeScheduler : public IScheduler {
public:
  explicit CfsLikeScheduler(Tick target_latency = 6, Tick min_granularity = 1);

  std::string name() const override { return "CFS_LIKE"; }

  void on_ready(ProcessId pid, Tick now, const SchedulerContext& ctx) override;
  std::optional<ProcessId> select_next(const SchedulerContext& ctx) override;
  bool should_preempt(const SchedulerContext& ctx) override;
  std::optional<Tick> time_slice(ProcessId pid, const SchedulerContext& ctx) const override;
  void on_dispatch(ProcessId pid, Tick now, const SchedulerContext& ctx) override;
  void on_quantum_expired(ProcessId pid, Tick now, const SchedulerContext& ctx) override;
  void on_cpu_burst_completed(ProcessId pid, Tick now, const SchedulerContext& ctx) override;
  void reset() override;

  static int nice_to_weight(int nice_val);
  double get_vruntime(ProcessId pid) const;
  void update_vruntime(ProcessId pid, Tick delta_ticks, int nice_val);

private:
  Tick target_latency_ = 6;
  Tick min_granularity_ = 1;
  std::vector<ProcessId> ready_pids_;
  std::vector<std::pair<ProcessId, double>> vruntimes_;

  double& find_or_create_vruntime(ProcessId pid);
};

} // namespace kernellens
