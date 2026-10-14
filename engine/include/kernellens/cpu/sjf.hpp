#pragma once

#include "kernellens/cpu/scheduler.hpp"
#include <vector>

namespace kernellens {

class SjfScheduler : public IScheduler {
public:
  std::string name() const override { return "SJF"; }

  void on_ready(ProcessId pid, Tick now, const SchedulerContext& ctx) override;
  std::optional<ProcessId> select_next(const SchedulerContext& ctx) override;
  bool should_preempt(const SchedulerContext& ctx) override;
  std::optional<Tick> time_slice(ProcessId pid, const SchedulerContext& ctx) const override;
  void on_dispatch(ProcessId pid, Tick now, const SchedulerContext& ctx) override;
  void on_quantum_expired(ProcessId pid, Tick now, const SchedulerContext& ctx) override;
  void on_cpu_burst_completed(ProcessId pid, Tick now, const SchedulerContext& ctx) override;
  void reset() override;

private:
  std::vector<ProcessId> ready_pids_;
};

} // namespace kernellens
