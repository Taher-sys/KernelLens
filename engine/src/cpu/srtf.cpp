#include "kernellens/cpu/srtf.hpp"
#include <algorithm>

namespace kernellens {

void SrtfScheduler::on_ready(ProcessId pid, Tick now, const SchedulerContext& ctx) {
  (void)now;
  (void)ctx;
  if (std::find(ready_pids_.begin(), ready_pids_.end(), pid) == ready_pids_.end()) {
    ready_pids_.push_back(pid);
  }
}

std::optional<ProcessId> SrtfScheduler::select_next(const SchedulerContext& ctx) {
  if (ready_pids_.empty()) {
    return std::nullopt;
  }

  auto best_it = ready_pids_.end();
  Tick min_remaining = -1;
  Tick earliest_arrival = -1;

  for (auto it = ready_pids_.begin(); it != ready_pids_.end(); ++it) {
    const ProcessRuntime* pr = ctx.find_process(*it);
    if (!pr) continue;

    Tick rem = pr->remaining_current_burst;
    Tick arrival = pr->spec.arrival_time;

    if (best_it == ready_pids_.end() ||
        rem < min_remaining ||
        (rem == min_remaining && arrival < earliest_arrival) ||
        (rem == min_remaining && arrival == earliest_arrival && *it < *best_it)) {
      best_it = it;
      min_remaining = rem;
      earliest_arrival = arrival;
    }
  }

  if (best_it != ready_pids_.end()) {
    ProcessId selected = *best_it;
    ready_pids_.erase(best_it);
    return selected;
  }

  return std::nullopt;
}

bool SrtfScheduler::should_preempt(const SchedulerContext& ctx) {
  if (!ctx.running_pid.has_value() || ready_pids_.empty()) {
    return false;
  }
  const ProcessRuntime* running_pr = ctx.find_process(*ctx.running_pid);
  if (!running_pr) return false;

  for (ProcessId pid : ready_pids_) {
    const ProcessRuntime* ready_pr = ctx.find_process(pid);
    if (ready_pr && ready_pr->remaining_current_burst < running_pr->remaining_current_burst) {
      return true;
    }
  }
  return false;
}

std::optional<Tick> SrtfScheduler::time_slice(ProcessId pid, const SchedulerContext& ctx) const {
  (void)pid;
  (void)ctx;
  return std::nullopt; // Continuous evaluation on arrival
}

void SrtfScheduler::on_dispatch(ProcessId pid, Tick now, const SchedulerContext& ctx) {
  (void)pid;
  (void)now;
  (void)ctx;
}

void SrtfScheduler::on_quantum_expired(ProcessId pid, Tick now, const SchedulerContext& ctx) {
  (void)pid;
  (void)now;
  (void)ctx;
}

void SrtfScheduler::on_cpu_burst_completed(ProcessId pid, Tick now, const SchedulerContext& ctx) {
  (void)pid;
  (void)now;
  (void)ctx;
}

void SrtfScheduler::reset() {
  ready_pids_.clear();
}

} // namespace kernellens
