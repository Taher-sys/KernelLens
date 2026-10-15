#include "kernellens/interrupt/interrupt.hpp"
#include <sstream>

namespace kernellens {

InterruptController::InterruptController(EventLog* log) : log_(log) {
  initialize_default_vectors();
}

void InterruptController::initialize_default_vectors() {
  register_vector(0, InterruptType::Exception, "DIV_BY_ZERO", 0, [](Tick, ProcessExecutionContext&) {});
  register_vector(14, InterruptType::Exception, "PAGE_FAULT", 1, [](Tick, ProcessExecutionContext&) {});
  register_vector(32, InterruptType::Hardware, "IRQ0_TIMER", 2, [](Tick, ProcessExecutionContext&) {});
  register_vector(46, InterruptType::Hardware, "IRQ14_DISK_DMA", 3, [](Tick, ProcessExecutionContext&) {});
  register_vector(33, InterruptType::Hardware, "IRQ1_KEYBOARD", 5, [](Tick, ProcessExecutionContext&) {});
  register_vector(128, InterruptType::Software, "SYS_TRAP_0x80", 8, [](Tick, ProcessExecutionContext&) {});
}

void InterruptController::register_vector(std::uint8_t vector_num, InterruptType type,
                                         std::string name, std::uint8_t priority,
                                         InterruptHandler handler) {
  InterruptVectorEntry entry;
  entry.vector_num = vector_num;
  entry.type = type;
  entry.name = std::move(name);
  entry.priority = priority;
  entry.handler = std::move(handler);

  ivt_[vector_num] = std::move(entry);
  vector_masks_[vector_num] = false;
}

void InterruptController::disable_interrupts(Tick now) {
  if (global_interrupt_enabled_) {
    global_interrupt_enabled_ = false;
    if (log_) {
      log_->emit("interrupt", "interrupts_disabled_cli", std::nullopt, now, "{\"instruction\":\"CLI\"}");
    }
  }
}

void InterruptController::enable_interrupts(Tick now) {
  if (!global_interrupt_enabled_) {
    global_interrupt_enabled_ = true;
    if (log_) {
      log_->emit("interrupt", "interrupts_enabled_sti", std::nullopt, now, "{\"instruction\":\"STI\"}");
    }
  }
}

void InterruptController::set_vector_mask(std::uint8_t vector_num, bool masked) {
  vector_masks_[vector_num] = masked;
}

bool InterruptController::is_vector_masked(std::uint8_t vector_num) const {
  auto it = vector_masks_.find(vector_num);
  if (it != vector_masks_.end()) return it->second;
  return false;
}

bool InterruptController::raise_interrupt(std::uint8_t vector_num, std::string source,
                                          ProcessExecutionContext* ctx, Tick now) {
  total_raised_++;
  auto it = ivt_.find(vector_num);
  if (it == ivt_.end()) return false;

  const auto& entry = it->second;
  vector_counts_[entry.name]++;

  if (log_) {
    std::ostringstream ss;
    ss << "{\"vector\":" << static_cast<int>(vector_num)
       << ",\"name\":\"" << entry.name << "\""
       << ",\"priority\":" << static_cast<int>(entry.priority)
       << ",\"type\":\"" << to_string(entry.type) << "\""
       << ",\"source\":\"" << source << "\"}";
    log_->emit("interrupt", "interrupt_raised", ctx ? std::optional<ProcessId>(ctx->pid) : std::nullopt, now, ss.str());
  }

  // Check if masked
  bool masked = !global_interrupt_enabled_ || is_vector_masked(vector_num);
  if (masked && entry.type != InterruptType::Exception) { // Exceptions are Non-Maskable Traps
    total_masked_deferred_++;
    PendingInterrupt pending;
    pending.vector_num = vector_num;
    pending.type = entry.type;
    pending.priority = entry.priority;
    pending.raised_at = now;
    pending.source = std::move(source);
    pending.seq = next_interrupt_seq_++;
    pending_queue_.push(pending);
    if (pending_queue_.size() > peak_pending_) peak_pending_ = pending_queue_.size();

    if (log_) {
      std::ostringstream ss;
      ss << "{\"vector\":" << static_cast<int>(vector_num)
         << ",\"status\":\"QUEUED_DEFERRED\""
         << ",\"pending_queue_size\":" << pending_queue_.size() << "}";
      log_->emit("interrupt", "interrupt_masked", ctx ? std::optional<ProcessId>(ctx->pid) : std::nullopt, now, ss.str());
    }
    return false;
  }

  // Check priority vs current IPL for nesting
  if (entry.priority < current_ipl_) {
    // Higher priority (lower integer): preempts current level
    if (current_ipl_ < 255) {
      total_nested_++;
      if (log_) {
        std::ostringstream ss;
        ss << "{\"preempting_vector\":" << static_cast<int>(vector_num)
           << ",\"preempted_ipl\":" << static_cast<int>(current_ipl_)
           << ",\"new_ipl\":" << static_cast<int>(entry.priority) << "}";
        log_->emit("interrupt", "interrupt_nested", ctx ? std::optional<ProcessId>(ctx->pid) : std::nullopt, now, ss.str());
      }
    }

    ipl_stack_.push_back(current_ipl_);
    current_ipl_ = entry.priority;
    total_handled_++;

    if (log_) {
      std::ostringstream ss;
      ss << "{\"vector\":" << static_cast<int>(vector_num)
         << ",\"name\":\"" << entry.name << "\""
         << ",\"ipl\":" << static_cast<int>(current_ipl_) << "}";
      log_->emit("interrupt", "interrupt_dispatched", ctx ? std::optional<ProcessId>(ctx->pid) : std::nullopt, now, ss.str());
    }

    if (ctx && entry.handler) {
      entry.handler(now, *ctx);
    }
    return true;
  } else {
    // Equal or lower priority: queue in pending
    PendingInterrupt pending;
    pending.vector_num = vector_num;
    pending.type = entry.type;
    pending.priority = entry.priority;
    pending.raised_at = now;
    pending.source = std::move(source);
    pending.seq = next_interrupt_seq_++;
    pending_queue_.push(pending);
    if (pending_queue_.size() > peak_pending_) peak_pending_ = pending_queue_.size();
    return false;
  }
}

void InterruptController::complete_interrupt(std::uint8_t vector_num,
                                             ProcessExecutionContext& ctx, Tick now) {
  if (log_) {
    std::ostringstream ss;
    ss << "{\"vector\":" << static_cast<int>(vector_num)
       << ",\"completed_ipl\":" << static_cast<int>(current_ipl_) << "}";
    log_->emit("interrupt", "interrupt_completed", ctx.pid, now, ss.str());
  }

  if (!ipl_stack_.empty()) {
    current_ipl_ = ipl_stack_.back();
    ipl_stack_.pop_back();
  } else {
    current_ipl_ = 255;
  }

  // Attempt to dispatch next pending interrupt if unmasked
  if (global_interrupt_enabled_) {
    dispatch_pending(ctx, now);
  }
}

bool InterruptController::dispatch_pending(ProcessExecutionContext& ctx, Tick now) {
  if (!global_interrupt_enabled_ || pending_queue_.empty()) return false;

  auto top = pending_queue_.top();
  if (is_vector_masked(top.vector_num)) return false;

  if (top.priority < current_ipl_) {
    pending_queue_.pop();
    ipl_stack_.push_back(current_ipl_);
    current_ipl_ = top.priority;
    total_handled_++;

    auto it = ivt_.find(top.vector_num);
    if (it != ivt_.end()) {
      if (log_) {
        std::ostringstream ss;
        ss << "{\"vector\":" << static_cast<int>(top.vector_num)
           << ",\"name\":\"" << it->second.name << "\""
           << ",\"ipl\":" << static_cast<int>(current_ipl_)
           << ",\"source\":\"PENDING_QUEUE\"}";
        log_->emit("interrupt", "interrupt_dispatched", ctx.pid, now, ss.str());
      }
      if (it->second.handler) {
        it->second.handler(now, ctx);
      }
    }
    return true;
  }
  return false;
}

InterruptMetrics InterruptController::compute_metrics() const {
  InterruptMetrics m;
  m.total_raised = total_raised_;
  m.total_handled = total_handled_;
  m.total_masked_deferred = total_masked_deferred_;
  m.total_nested_interrupts = total_nested_;
  m.peak_pending_queue = peak_pending_;
  m.vector_counts = vector_counts_;
  return m;
}

std::string InterruptMetrics::to_json() const {
  std::ostringstream ss;
  ss << "{"
     << "\"total_raised\":" << total_raised << ","
     << "\"total_handled\":" << total_handled << ","
     << "\"total_masked_deferred\":" << total_masked_deferred << ","
     << "\"total_nested_interrupts\":" << total_nested_interrupts << ","
     << "\"peak_pending_queue\":" << peak_pending_queue << ","
     << "\"vector_counts\":{";
  bool first = true;
  for (const auto& pair : vector_counts) {
    if (!first) ss << ",";
    first = false;
    ss << "\"" << pair.first << "\":" << pair.second;
  }
  ss << "}}";
  return ss.str();
}

std::string InterruptController::to_json() const {
  std::ostringstream ss;
  ss << "{"
     << "\"metrics\":" << compute_metrics().to_json()
     << "}";
  return ss.str();
}

void InterruptController::reset() {
  global_interrupt_enabled_ = true;
  current_ipl_ = 255;
  ipl_stack_.clear();
  while (!pending_queue_.empty()) pending_queue_.pop();
  total_raised_ = 0;
  total_handled_ = 0;
  total_masked_deferred_ = 0;
  total_nested_ = 0;
  peak_pending_ = 0;
  vector_counts_.clear();
}

} // namespace kernellens
