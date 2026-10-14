#include "kernellens/cpu/mlfq.hpp"
#include <algorithm>

namespace kernellens {

MlfqScheduler::MlfqScheduler(std::vector<Tick> quanta, Tick boost_interval)
    : quanta_(std::move(quanta)), boost_interval_(boost_interval), queues_(quanta_.size()) {}

int MlfqScheduler::find_or_create_level(ProcessId pid) {
  for (auto& p : process_levels_) {
    if (p.first == pid) return p.second;
  }
  process_levels_.emplace_back(pid, 0);
  return 0;
}

int MlfqScheduler::get_process_level(ProcessId pid) const {
  for (const auto& p : process_levels_) {
    if (p.first == pid) return p.second;
  }
  return 0;
}

void MlfqScheduler::perform_priority_boost(Tick now) {
  last_boost_time_ = now;
  for (auto& p : process_levels_) {
    p.second = 0;
  }

  // Gather all ready processes and place into Q0
  std::vector<ProcessId> all_ready;
  for (auto& q : queues_) {
    while (!q.empty()) {
      all_ready.push_back(q.front());
      q.pop_front();
    }
  }
  for (ProcessId pid : all_ready) {
    queues_[0].push_back(pid);
  }
}

void MlfqScheduler::on_ready(ProcessId pid, Tick now, const SchedulerContext& ctx) {
  (void)ctx;
  if (boost_interval_ > 0 && (now - last_boost_time_) >= boost_interval_) {
    perform_priority_boost(now);
  }

  int level = find_or_create_level(pid);
  if (level >= static_cast<int>(queues_.size())) {
    level = static_cast<int>(queues_.size()) - 1;
  }

  auto& q = queues_[level];
  if (std::find(q.begin(), q.end(), pid) == q.end()) {
    q.push_back(pid);
  }
}

std::optional<ProcessId> MlfqScheduler::select_next(const SchedulerContext& ctx) {
  if (boost_interval_ > 0 && (ctx.now - last_boost_time_) >= boost_interval_) {
    perform_priority_boost(ctx.now);
  }

  for (auto& q : queues_) {
    if (!q.empty()) {
      ProcessId next_pid = q.front();
      q.pop_front();
      return next_pid;
    }
  }
  return std::nullopt;
}

bool MlfqScheduler::should_preempt(const SchedulerContext& ctx) {
  if (!ctx.running_pid.has_value()) return false;

  int running_level = get_process_level(*ctx.running_pid);
  // If there is any ready process in a strictly higher queue (lower index)
  for (int i = 0; i < running_level; ++i) {
    if (!queues_[i].empty()) {
      return true;
    }
  }
  return false;
}

std::optional<Tick> MlfqScheduler::time_slice(ProcessId pid, const SchedulerContext& ctx) const {
  (void)ctx;
  int level = get_process_level(pid);
  if (level < static_cast<int>(quanta_.size())) {
    return quanta_[level];
  }
  return quanta_.back();
}

void MlfqScheduler::on_dispatch(ProcessId pid, Tick now, const SchedulerContext& ctx) {
  (void)pid;
  (void)now;
  (void)ctx;
}

void MlfqScheduler::on_quantum_expired(ProcessId pid, Tick now, const SchedulerContext& ctx) {
  (void)now;
  (void)ctx;
  int current_lvl = get_process_level(pid);
  int next_lvl = std::min(current_lvl + 1, static_cast<int>(queues_.size()) - 1);

  for (auto& p : process_levels_) {
    if (p.first == pid) {
      p.second = next_lvl;
      break;
    }
  }

  // Re-enqueue in lower queue
  auto& q = queues_[next_lvl];
  if (std::find(q.begin(), q.end(), pid) == q.end()) {
    q.push_back(pid);
  }
}

void MlfqScheduler::on_cpu_burst_completed(ProcessId pid, Tick now, const SchedulerContext& ctx) {
  (void)pid;
  (void)now;
  (void)ctx;
  // If it yields early (e.g. for I/O), it preserves its current level
}

void MlfqScheduler::reset() {
  for (auto& q : queues_) {
    q.clear();
  }
  process_levels_.clear();
  last_boost_time_ = 0;
}

} // namespace kernellens
