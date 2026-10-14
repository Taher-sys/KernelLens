#include "kernellens/cpu/fcfs.hpp"
#include <algorithm>

namespace kernellens {

void FcfsScheduler::on_ready(ProcessId pid, Tick now, const SchedulerContext& ctx) {
  (void)now;
  (void)ctx;
  if (std::find(ready_queue_.begin(), ready_queue_.end(), pid) == ready_queue_.end()) {
    ready_queue_.push_back(pid);
  }
}

std::optional<ProcessId> FcfsScheduler::select_next(const SchedulerContext& ctx) {
  (void)ctx;
  if (ready_queue_.empty()) {
    return std::nullopt;
  }
  ProcessId next_pid = ready_queue_.front();
  ready_queue_.pop_front();
  return next_pid;
}

bool FcfsScheduler::should_preempt(const SchedulerContext& ctx) {
  (void)ctx;
  return false;
}

std::optional<Tick> FcfsScheduler::time_slice(ProcessId pid, const SchedulerContext& ctx) const {
  (void)pid;
  (void)ctx;
  return std::nullopt; // Non-preemptive, runs full burst
}

void FcfsScheduler::on_dispatch(ProcessId pid, Tick now, const SchedulerContext& ctx) {
  (void)pid;
  (void)now;
  (void)ctx;
}

void FcfsScheduler::on_quantum_expired(ProcessId pid, Tick now, const SchedulerContext& ctx) {
  (void)pid;
  (void)now;
  (void)ctx;
}

void FcfsScheduler::on_cpu_burst_completed(ProcessId pid, Tick now, const SchedulerContext& ctx) {
  (void)pid;
  (void)now;
  (void)ctx;
}

void FcfsScheduler::reset() {
  ready_queue_.clear();
}

} // namespace kernellens
