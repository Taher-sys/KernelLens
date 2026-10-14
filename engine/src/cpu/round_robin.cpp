#include "kernellens/cpu/round_robin.hpp"
#include <algorithm>
#include <stdexcept>

namespace kernellens {

RoundRobinScheduler::RoundRobinScheduler(Tick quantum) : quantum_(quantum) {
  if (quantum_ <= 0) {
    throw std::invalid_argument("RoundRobin quantum must be positive");
  }
}

void RoundRobinScheduler::on_ready(ProcessId pid, Tick now, const SchedulerContext& ctx) {
  (void)now;
  (void)ctx;
  if (std::find(ready_queue_.begin(), ready_queue_.end(), pid) == ready_queue_.end()) {
    ready_queue_.push_back(pid);
  }
}

std::optional<ProcessId> RoundRobinScheduler::select_next(const SchedulerContext& ctx) {
  (void)ctx;
  if (ready_queue_.empty()) {
    return std::nullopt;
  }
  ProcessId next_pid = ready_queue_.front();
  ready_queue_.pop_front();
  return next_pid;
}

bool RoundRobinScheduler::should_preempt(const SchedulerContext& ctx) {
  (void)ctx;
  return false;
}

std::optional<Tick> RoundRobinScheduler::time_slice(ProcessId pid, const SchedulerContext& ctx) const {
  (void)pid;
  (void)ctx;
  return quantum_;
}

void RoundRobinScheduler::on_dispatch(ProcessId pid, Tick now, const SchedulerContext& ctx) {
  (void)pid;
  (void)now;
  (void)ctx;
}

void RoundRobinScheduler::on_quantum_expired(ProcessId pid, Tick now, const SchedulerContext& ctx) {
  (void)now;
  (void)ctx;
  if (std::find(ready_queue_.begin(), ready_queue_.end(), pid) == ready_queue_.end()) {
    ready_queue_.push_back(pid);
  }
}

void RoundRobinScheduler::on_cpu_burst_completed(ProcessId pid, Tick now, const SchedulerContext& ctx) {
  (void)pid;
  (void)now;
  (void)ctx;
}

void RoundRobinScheduler::reset() {
  ready_queue_.clear();
}

} // namespace kernellens
