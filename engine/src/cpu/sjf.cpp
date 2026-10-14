#include "kernellens/cpu/sjf.hpp"
#include <algorithm>

namespace kernellens {

void SjfScheduler::on_ready(ProcessId pid, Tick now, const SchedulerContext& ctx) {
  (void)now;
  (void)ctx;
  if (std::find(ready_pids_.begin(), ready_pids_.end(), pid) == ready_pids_.end()) {
    ready_pids_.push_back(pid);
  }
}

std::optional<ProcessId> SjfScheduler::select_next(const SchedulerContext& ctx) {
  if (ready_pids_.empty()) {
    return std::nullopt;
  }

  auto best_it = ready_pids_.end();
  Tick min_burst = -1;
  Tick earliest_arrival = -1;

  for (auto it = ready_pids_.begin(); it != ready_pids_.end(); ++it) {
    const ProcessRuntime* pr = ctx.find_process(*it);
    if (!pr) continue;

    Tick burst = pr->remaining_current_burst;
    Tick arrival = pr->spec.arrival_time;

    if (best_it == ready_pids_.end() ||
        burst < min_burst ||
        (burst == min_burst && arrival < earliest_arrival) ||
        (burst == min_burst && arrival == earliest_arrival && *it < *best_it)) {
      best_it = it;
      min_burst = burst;
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

bool SjfScheduler::should_preempt(const SchedulerContext& ctx) {
  (void)ctx;
  return false; // Non-preemptive
}

std::optional<Tick> SjfScheduler::time_slice(ProcessId pid, const SchedulerContext& ctx) const {
  (void)pid;
  (void)ctx;
  return std::nullopt;
}

void SjfScheduler::on_dispatch(ProcessId pid, Tick now, const SchedulerContext& ctx) {
  (void)pid;
  (void)now;
  (void)ctx;
}

void SjfScheduler::on_quantum_expired(ProcessId pid, Tick now, const SchedulerContext& ctx) {
  (void)pid;
  (void)now;
  (void)ctx;
}

void SjfScheduler::on_cpu_burst_completed(ProcessId pid, Tick now, const SchedulerContext& ctx) {
  (void)pid;
  (void)now;
  (void)ctx;
}

void SjfScheduler::reset() {
  ready_pids_.clear();
}

} // namespace kernellens
