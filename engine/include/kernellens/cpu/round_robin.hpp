#pragma once

#include "kernellens/cpu/scheduler.hpp"
#include <deque>

namespace kernellens {

class RoundRobinScheduler : public IScheduler {
public:
  explicit RoundRobinScheduler(Tick quantum = 3);

  std::string name() const override { return "ROUND_ROBIN"; }

  Tick quantum() const noexcept { return quantum_; }
  void set_quantum(Tick q) { quantum_ = q; }

  void on_ready(ProcessId pid, Tick now, const SchedulerContext& ctx) override;
  std::optional<ProcessId> select_next(const SchedulerContext& ctx) override;
  bool should_preempt(const SchedulerContext& ctx) override;
  std::optional<Tick> time_slice(ProcessId pid, const SchedulerContext& ctx) const override;
  void on_dispatch(ProcessId pid, Tick now, const SchedulerContext& ctx) override;
  void on_quantum_expired(ProcessId pid, Tick now, const SchedulerContext& ctx) override;
  void on_cpu_burst_completed(ProcessId pid, Tick now, const SchedulerContext& ctx) override;
  void reset() override;

private:
  Tick quantum_ = 3;
  std::deque<ProcessId> ready_queue_;
};

} // namespace kernellens
