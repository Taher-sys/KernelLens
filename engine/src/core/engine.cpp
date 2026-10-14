#include "kernellens/core/engine.hpp"
#include <algorithm>
#include <sstream>

namespace kernellens {

SimulationEngine::SimulationEngine(SimulationConfig config)
    : config_(std::move(config)), log_(config_.run_id) {}

void SimulationEngine::set_scheduler(std::unique_ptr<IScheduler> scheduler) {
  scheduler_ = std::move(scheduler);
}

ProcessRuntime* SimulationEngine::get_process(ProcessId pid) {
  for (auto& pr : processes_) {
    if (pr.spec.pid == pid) return &pr;
  }
  return nullptr;
}

void SimulationEngine::load_workload(const std::vector<ProcessSpec>& specs) {
  processes_.clear();
  ready_pids_.clear();
  running_pid_ = std::nullopt;
  context_switch_count_ = 0;
  clock_.reset();
  log_.clear();
  if (scheduler_) {
    scheduler_->reset();
  }

  for (const auto& sp : specs) {
    ProcessRuntime pr;
    pr.spec = sp;
    pr.state = ProcessState::New;
    pr.burst_index = 0;
    pr.remaining_current_burst = sp.bursts.empty() ? 0 : sp.bursts[0].duration;
    pr.current_priority = sp.base_priority;
    processes_.push_back(std::move(pr));
  }

  schedule_arrivals();
}

void SimulationEngine::schedule_arrivals() {
  for (auto& pr : processes_) {
    ProcessId pid = pr.spec.pid;
    Tick arrival = pr.spec.arrival_time;

    clock_.schedule(arrival, EventPriority::Normal, "Process Arrival", [this, pid](Tick now) {
      ProcessRuntime* p = get_process(pid);
      if (!p) return;

      p->state = ProcessState::Ready;
      p->last_ready_time = now;
      ready_pids_.push_back(pid);

      std::ostringstream ss;
      ss << "{\"priority\":" << p->spec.base_priority
         << ",\"initialBurst\":" << p->remaining_current_burst << "}";
      log_.emit("cpu", "process_arrived", pid, now, ss.str());

      SchedulerContext ctx{now, running_pid_, &processes_, &ready_pids_};
      if (scheduler_) {
        scheduler_->on_ready(pid, now, ctx);

        // Check if preemption is warranted
        if (running_pid_.has_value() && scheduler_->should_preempt(ctx)) {
          // Preempt current running process
          ProcessId cur_pid = *running_pid_;
          ProcessRuntime* cur_pr = get_process(cur_pid);
          if (cur_pr) {
            cur_pr->state = ProcessState::Ready;
            cur_pr->last_ready_time = now;
            ready_pids_.push_back(cur_pid);
            scheduler_->on_ready(cur_pid, now, ctx);

            std::ostringstream pss;
            pss << "{\"preemptedBy\":" << pid
                << ",\"remainingBurst\":" << cur_pr->remaining_current_burst << "}";
            log_.emit("cpu", "preempt", cur_pid, now, pss.str());

            running_pid_ = std::nullopt;
          }
        }
      }

      try_schedule();
    });
  }
}

void SimulationEngine::try_schedule() {
  if (running_pid_.has_value() || !scheduler_) {
    return;
  }

  Tick now = clock_.now();
  SchedulerContext ctx{now, running_pid_, &processes_, &ready_pids_};
  auto next_pid = scheduler_->select_next(ctx);
  if (!next_pid.has_value()) {
    return;
  }

  ProcessId pid = *next_pid;
  auto it = std::find(ready_pids_.begin(), ready_pids_.end(), pid);
  if (it != ready_pids_.end()) {
    ready_pids_.erase(it);
  }

  ProcessRuntime* pr = get_process(pid);
  if (!pr) return;

  // Context switch accounting
  context_switch_count_++;
  Tick dispatch_time = now + config_.context_switch_cost;

  if (pr->last_ready_time >= 0) {
    pr->ready_wait += (now - pr->last_ready_time);
  }
  if (pr->first_run_time < 0) {
    pr->first_run_time = dispatch_time;
  }

  pr->state = ProcessState::Running;
  running_pid_ = pid;

  SchedulerContext dispatch_ctx{dispatch_time, running_pid_, &processes_, &ready_pids_};
  scheduler_->on_dispatch(pid, dispatch_time, dispatch_ctx);

  auto slice_opt = scheduler_->time_slice(pid, dispatch_ctx);
  Tick burst_remaining = pr->remaining_current_burst;

  std::ostringstream ss;
  ss << "{\"policy\":\"" << scheduler_->name() << "\""
     << ",\"remainingBurst\":" << burst_remaining;
  if (slice_opt.has_value()) {
    ss << ",\"quantum\":" << *slice_opt;
  }
  ss << "}";
  log_.emit("cpu", "dispatch", pid, dispatch_time, ss.str());

  if (slice_opt.has_value() && *slice_opt < burst_remaining) {
    Tick slice = *slice_opt;
    clock_.schedule(dispatch_time + slice, EventPriority::Low, "Quantum Expiration", [this, pid, slice](Tick exp_time) {
      if (running_pid_ != pid) return;

      ProcessRuntime* p = get_process(pid);
      if (!p) return;

      p->remaining_current_burst -= slice;
      p->cpu_service += slice;
      p->state = ProcessState::Ready;
      p->last_ready_time = exp_time;
      ready_pids_.push_back(pid);

      std::ostringstream qss;
      qss << "{\"quantum\":" << slice
          << ",\"remainingBurst\":" << p->remaining_current_burst << "}";
      log_.emit("cpu", "quantum_expired", pid, exp_time, qss.str());

      running_pid_ = std::nullopt;
      SchedulerContext qctx{exp_time, running_pid_, &processes_, &ready_pids_};
      if (scheduler_) {
        scheduler_->on_quantum_expired(pid, exp_time, qctx);
      }
      try_schedule();
    });
  } else {
    // Process completes this CPU burst
    clock_.schedule(dispatch_time + burst_remaining, EventPriority::Low, "CPU Burst Completed", [this, pid, burst_remaining](Tick fin_time) {
      if (running_pid_ != pid) return;

      ProcessRuntime* p = get_process(pid);
      if (!p) return;

      p->cpu_service += burst_remaining;
      p->remaining_current_burst = 0;
      running_pid_ = std::nullopt;

      SchedulerContext fin_ctx{fin_time, running_pid_, &processes_, &ready_pids_};
      if (scheduler_) {
        scheduler_->on_cpu_burst_completed(pid, fin_time, fin_ctx);
      }

      on_process_burst_finished(pid);
      try_schedule();
    });
  }
}

void SimulationEngine::on_process_burst_finished(ProcessId pid) {
  ProcessRuntime* p = get_process(pid);
  if (!p) return;

  Tick now = clock_.now();
  p->burst_index++;

  std::ostringstream bss;
  bss << "{\"completedBurstIndex\":" << (p->burst_index - 1) << "}";
  log_.emit("cpu", "cpu_burst_completed", pid, now, bss.str());

  if (p->burst_index < p->spec.bursts.size()) {
    const auto& next_burst = p->spec.bursts[p->burst_index];
    if (next_burst.kind == BurstKind::Io) {
      p->state = ProcessState::Waiting;
      Tick io_duration = next_burst.duration;

      std::ostringstream ioss;
      ioss << "{\"ioDuration\":" << io_duration << "}";
      log_.emit("cpu", "io_started", pid, now, ioss.str());

      clock_.schedule(now + io_duration, EventPriority::High, "IO Completed", [this, pid](Tick io_fin_time) {
        ProcessRuntime* pr = get_process(pid);
        if (!pr) return;

        log_.emit("cpu", "io_completed", pid, io_fin_time, "{}");
        pr->burst_index++;

        if (pr->burst_index < pr->spec.bursts.size()) {
          pr->remaining_current_burst = pr->spec.bursts[pr->burst_index].duration;
          pr->state = ProcessState::Ready;
          pr->last_ready_time = io_fin_time;
          ready_pids_.push_back(pid);

          SchedulerContext io_ctx{io_fin_time, running_pid_, &processes_, &ready_pids_};
          if (scheduler_) {
            scheduler_->on_ready(pid, io_fin_time, io_ctx);
          }
        } else {
          pr->state = ProcessState::Terminated;
          pr->finish_time = io_fin_time;
          log_.emit("cpu", "process_terminated", pid, io_fin_time, "{}");
        }
        try_schedule();
      });
    } else {
      // Immediate next CPU burst
      p->remaining_current_burst = next_burst.duration;
      p->state = ProcessState::Ready;
      p->last_ready_time = now;
      ready_pids_.push_back(pid);

      SchedulerContext ctx{now, running_pid_, &processes_, &ready_pids_};
      if (scheduler_) {
        scheduler_->on_ready(pid, now, ctx);
      }
    }
  } else {
    // Process terminated
    p->state = ProcessState::Terminated;
    p->finish_time = now;

    std::ostringstream tss;
    tss << "{\"turnaround\":" << (p->finish_time - p->spec.arrival_time)
        << ",\"waiting\":" << p->ready_wait
        << ",\"response\":" << (p->first_run_time - p->spec.arrival_time) << "}";
    log_.emit("cpu", "process_terminated", pid, now, tss.str());
  }
}

bool SimulationEngine::is_finished() const {
  if (clock_.has_events()) return false;
  for (const auto& pr : processes_) {
    if (!pr.is_completed()) return false;
  }
  return true;
}

bool SimulationEngine::step() {
  if (is_finished()) {
    metrics_ = MetricsCalculator::compute(processes_, clock_.now(), context_switch_count_, config_.context_switch_cost);
    return false;
  }

  bool ok = clock_.step();
  if (is_finished() || !ok) {
    metrics_ = MetricsCalculator::compute(processes_, clock_.now(), context_switch_count_, config_.context_switch_cost);
    return false;
  }
  return true;
}

void SimulationEngine::run() {
  while (!is_finished() && clock_.now() < config_.max_ticks) {
    if (!clock_.step()) {
      break;
    }
  }
  metrics_ = MetricsCalculator::compute(processes_, clock_.now(), context_switch_count_, config_.context_switch_cost);
}

} // namespace kernellens
