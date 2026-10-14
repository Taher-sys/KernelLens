#pragma once

#include "kernellens/cpu/scheduler.hpp"
#include <vector>

namespace kernellens {

class PriorityScheduler : public IScheduler {
public:
  explicit PriorityScheduler(bool preemptive = false, Tick aging_interval = 0);

  std::string name() const override {
    return preemptive_ ? "PRIORITY_PREEMPTIVE" : "PRIORITY_NON_PREEMPTIVE";
  }

  void on_ready(ProcessId pid, Tick now, const SchedulerContext& ctx) override;
  std::optional<ProcessId> select_next(const SchedulerContext& ctx) override;
  bool should_preempt(const SchedulerContext& ctx) override;
  std::optional<Tick> time_slice(ProcessId pid, const SchedulerContext& ctx) const override;
  void on_dispatch(ProcessId pid, Tick now, const SchedulerContext& ctx) override;
  void on_quantum_expired(ProcessId pid, Tick now, const SchedulerContext& ctx) override;
  void on_cpu_burst_completed(ProcessId pid, Tick now, const SchedulerContext& ctx) override;
  void reset() override;

  int compute_effective_priority(const ProcessRuntime& pr, Tick now) const;

private:
  bool preemptive_ = false;
  Tick aging_interval_ = 0; // 0 = no aging
  std::vector<ProcessId> ready_pids_;
};

} // namespace kernellens
