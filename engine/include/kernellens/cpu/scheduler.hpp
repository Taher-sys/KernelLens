#pragma once

#include "kernellens/core/types.hpp"
#include <string>
#include <vector>
#include <optional>
#include <memory>

namespace kernellens {

struct SchedulerContext {
  Tick now = 0;
  std::optional<ProcessId> running_pid = std::nullopt;
  const std::vector<ProcessRuntime>* processes = nullptr;
  const std::vector<ProcessId>* ready_pids = nullptr;

  const ProcessRuntime* find_process(ProcessId pid) const {
    if (!processes) return nullptr;
    for (const auto& pr : *processes) {
      if (pr.spec.pid == pid) return &pr;
    }
    return nullptr;
  }
};

class IScheduler {
public:
  virtual ~IScheduler() = default;

  virtual std::string name() const = 0;
  virtual void on_ready(ProcessId pid, Tick now, const SchedulerContext& ctx) = 0;
  virtual std::optional<ProcessId> select_next(const SchedulerContext& ctx) = 0;
  virtual bool should_preempt(const SchedulerContext& ctx) = 0;
  virtual std::optional<Tick> time_slice(ProcessId pid, const SchedulerContext& ctx) const = 0;
  virtual void on_dispatch(ProcessId pid, Tick now, const SchedulerContext& ctx) = 0;
  virtual void on_quantum_expired(ProcessId pid, Tick now, const SchedulerContext& ctx) = 0;
  virtual void on_cpu_burst_completed(ProcessId pid, Tick now, const SchedulerContext& ctx) = 0;
  virtual void reset() = 0;
};

} // namespace kernellens
