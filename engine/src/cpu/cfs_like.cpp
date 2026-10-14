#include "kernellens/cpu/cfs_like.hpp"
#include <algorithm>
#include <cmath>

namespace kernellens {

// Standard Linux kernel CFS nice level weight table [-20..19]
static const int SCHED_PRIO_TO_WEIGHT[40] = {
  /* -20 */ 88761, 71755, 56483, 46273, 36291,
  /* -15 */ 29154, 23254, 18705, 14949, 11916,
  /* -10 */  9548,  7620,  6100,  4904,  3906,
  /*  -5 */  3121,  2501,  1991,  1586,  1277,
  /*   0 */  1024,   820,   655,   526,   423,
  /*   5 */   335,   272,   215,   172,   137,
  /*  10 */   110,    87,    70,    56,    45,
  /*  15 */    36,    29,    23,    18,    15,
};

int CfsLikeScheduler::nice_to_weight(int nice_val) {
  int idx = nice_val + 20;
  if (idx < 0) idx = 0;
  if (idx > 39) idx = 39;
  return SCHED_PRIO_TO_WEIGHT[idx];
}

CfsLikeScheduler::CfsLikeScheduler(Tick target_latency, Tick min_granularity)
    : target_latency_(target_latency), min_granularity_(min_granularity) {}

double& CfsLikeScheduler::find_or_create_vruntime(ProcessId pid) {
  for (auto& p : vruntimes_) {
    if (p.first == pid) return p.second;
  }
  // Initialize new process with minimum current vruntime or 0
  double min_vr = 0.0;
  if (!vruntimes_.empty()) {
    min_vr = vruntimes_.front().second;
    for (const auto& p : vruntimes_) {
      if (p.second < min_vr) min_vr = p.second;
    }
  }
  vruntimes_.emplace_back(pid, min_vr);
  return vruntimes_.back().second;
}

double CfsLikeScheduler::get_vruntime(ProcessId pid) const {
  for (const auto& p : vruntimes_) {
    if (p.first == pid) return p.second;
  }
  return 0.0;
}

void CfsLikeScheduler::update_vruntime(ProcessId pid, Tick delta_ticks, int nice_val) {
  int weight = nice_to_weight(nice_val);
  double vdelta = static_cast<double>(delta_ticks) * (1024.0 / static_cast<double>(weight));
  find_or_create_vruntime(pid) += vdelta;
}

void CfsLikeScheduler::on_ready(ProcessId pid, Tick now, const SchedulerContext& ctx) {
  (void)now;
  (void)ctx;
  find_or_create_vruntime(pid);
  if (std::find(ready_pids_.begin(), ready_pids_.end(), pid) == ready_pids_.end()) {
    ready_pids_.push_back(pid);
  }
}

std::optional<ProcessId> CfsLikeScheduler::select_next(const SchedulerContext& ctx) {
  if (ready_pids_.empty()) {
    return std::nullopt;
  }

  auto best_it = ready_pids_.end();
  double min_vr = 1e18;
  Tick earliest_arrival = -1;

  for (auto it = ready_pids_.begin(); it != ready_pids_.end(); ++it) {
    double vr = get_vruntime(*it);
    const ProcessRuntime* pr = ctx.find_process(*it);
    Tick arrival = pr ? pr->spec.arrival_time : 0;

    if (best_it == ready_pids_.end() ||
        vr < min_vr ||
        (std::abs(vr - min_vr) < 1e-6 && arrival < earliest_arrival) ||
        (std::abs(vr - min_vr) < 1e-6 && arrival == earliest_arrival && *it < *best_it)) {
      best_it = it;
      min_vr = vr;
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

bool CfsLikeScheduler::should_preempt(const SchedulerContext& ctx) {
  if (!ctx.running_pid.has_value() || ready_pids_.empty()) {
    return false;
  }
  double running_vr = get_vruntime(*ctx.running_pid);
  for (ProcessId pid : ready_pids_) {
    double ready_vr = get_vruntime(pid);
    // Preempt if a ready process has accumulated noticeably less virtual runtime
    if (ready_vr + 1.0 < running_vr) {
      return true;
    }
  }
  return false;
}

std::optional<Tick> CfsLikeScheduler::time_slice(ProcessId pid, const SchedulerContext& ctx) const {
  (void)pid;
  std::size_t active_count = ready_pids_.size() + (ctx.running_pid.has_value() ? 1 : 0);
  if (active_count == 0) active_count = 1;

  Tick slice = target_latency_ / static_cast<Tick>(active_count);
  if (slice < min_granularity_) {
    slice = min_granularity_;
  }
  return slice;
}

void CfsLikeScheduler::on_dispatch(ProcessId pid, Tick now, const SchedulerContext& ctx) {
  (void)pid;
  (void)now;
  (void)ctx;
}

void CfsLikeScheduler::on_quantum_expired(ProcessId pid, Tick now, const SchedulerContext& ctx) {
  (void)now;
  const ProcessRuntime* pr = ctx.find_process(pid);
  int nice_val = pr ? pr->spec.nice_value : 0;
  // Advance virtual runtime by slice allocated
  Tick slice = time_slice(pid, ctx).value_or(min_granularity_);
  update_vruntime(pid, slice, nice_val);

  if (std::find(ready_pids_.begin(), ready_pids_.end(), pid) == ready_pids_.end()) {
    ready_pids_.push_back(pid);
  }
}

void CfsLikeScheduler::on_cpu_burst_completed(ProcessId pid, Tick now, const SchedulerContext& ctx) {
  (void)now;
  (void)ctx;
  (void)pid;
}

void CfsLikeScheduler::reset() {
  ready_pids_.clear();
  vruntimes_.clear();
}

} // namespace kernellens
