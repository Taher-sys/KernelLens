#include "kernellens/cpu/priority.hpp"
#include <algorithm>

namespace kernellens {

PriorityScheduler::PriorityScheduler(bool preemptive, Tick aging_interval)
    : preemptive_(preemptive), aging_interval_(aging_interval) {}

int PriorityScheduler::compute_effective_priority(const ProcessRuntime& pr, Tick now) const {
  int prio = pr.spec.base_priority;
  if (aging_interval_ > 0 && pr.last_ready_time >= 0 && now > pr.last_ready_time) {
    Tick wait = now - pr.last_ready_time;
    int age_boost = static_cast<int>(wait / aging_interval_);
    prio -= age_boost;
  }
  return prio;
}

void PriorityScheduler::on_ready(ProcessId pid, Tick now, const SchedulerContext& ctx) {
  (void)now;
  (void)ctx;
  if (std::find(ready_pids_.begin(), ready_pids_.end(), pid) == ready_pids_.end()) {
    ready_pids_.push_back(pid);
  }
}

std::optional<ProcessId> PriorityScheduler::select_next(const SchedulerContext& ctx) {
  if (ready_pids_.empty()) {
    return std::nullopt;
  }

  auto best_it = ready_pids_.end();
  int best_prio = 1e9;
  Tick earliest_arrival = -1;

  for (auto it = ready_pids_.begin(); it != ready_pids_.end(); ++it) {
    const ProcessRuntime* pr = ctx.find_process(*it);
    if (!pr) continue;

    int eff_prio = compute_effective_priority(*pr, ctx.now);
    Tick arrival = pr->spec.arrival_time;

    if (best_it == ready_pids_.end() ||
        eff_prio < best_prio ||
        (eff_prio == best_prio && arrival < earliest_arrival) ||
        (eff_prio == best_prio && arrival == earliest_arrival && *it < *best_it)) {
      best_it = it;
      best_prio = eff_prio;
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

bool PriorityScheduler::should_preempt(const SchedulerContext& ctx) {
  if (!preemptive_ || !ctx.running_pid.has_value() || ready_pids_.empty()) {
    return false;
  }
  const ProcessRuntime* running_pr = ctx.find_process(*ctx.running_pid);
  if (!running_pr) return false;

  int running_prio = compute_effective_priority(*running_pr, ctx.now);

  for (ProcessId pid : ready_pids_) {
    const ProcessRuntime* ready_pr = ctx.find_process(pid);
    if (ready_pr) {
      int ready_prio = compute_effective_priority(*ready_pr, ctx.now);
      if (ready_prio < running_prio) {
        return true;
      }
    }
  }
  return false;
}

std::optional<Tick> PriorityScheduler::time_slice(ProcessId pid, const SchedulerContext& ctx) const {
  (void)pid;
  (void)ctx;
  return std::nullopt;
}

void PriorityScheduler::on_dispatch(ProcessId pid, Tick now, const SchedulerContext& ctx) {
  (void)pid;
  (void)now;
  (void)ctx;
}

void PriorityScheduler::on_quantum_expired(ProcessId pid, Tick now, const SchedulerContext& ctx) {
  (void)pid;
  (void)now;
  (void)ctx;
}

void PriorityScheduler::on_cpu_burst_completed(ProcessId pid, Tick now, const SchedulerContext& ctx) {
  (void)pid;
  (void)now;
  (void)ctx;
}

void PriorityScheduler::reset() {
  ready_pids_.clear();
}

} // namespace kernellens
