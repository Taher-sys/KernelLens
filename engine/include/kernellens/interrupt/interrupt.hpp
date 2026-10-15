#pragma once

#include "kernellens/core/types.hpp"
#include "kernellens/core/event_log.hpp"
#include "kernellens/syscall/context.hpp"
#include <cstdint>
#include <string>
#include <vector>
#include <queue>
#include <map>
#include <functional>
#include <optional>

namespace kernellens {

enum class InterruptType {
  Hardware,
  Software,
  Exception
};

inline std::string to_string(InterruptType type) {
  switch (type) {
    case InterruptType::Hardware: return "HARDWARE";
    case InterruptType::Software: return "SOFTWARE";
    case InterruptType::Exception: return "EXCEPTION";
  }
  return "UNKNOWN";
}

using InterruptHandler = std::function<void(Tick, ProcessExecutionContext&)>;

struct InterruptVectorEntry {
  std::uint8_t vector_num = 0;
  InterruptType type = InterruptType::Hardware;
  std::string name;
  std::uint8_t priority = 10; // Lower number = higher hardware priority
  InterruptHandler handler;
};

struct PendingInterrupt {
  std::uint8_t vector_num = 0;
  InterruptType type = InterruptType::Hardware;
  std::uint8_t priority = 10;
  Tick raised_at = 0;
  std::string source;
  SequenceNo seq = 0;

  bool operator>(const PendingInterrupt& other) const {
    if (priority != other.priority) return priority > other.priority; // lower integer has priority
    return seq > other.seq; // FIFO tie break
  }
};

struct InterruptMetrics {
  std::size_t total_raised = 0;
  std::size_t total_handled = 0;
  std::size_t total_masked_deferred = 0;
  std::size_t total_nested_interrupts = 0;
  std::size_t peak_pending_queue = 0;
  std::map<std::string, std::size_t> vector_counts;

  std::string to_json() const;
};

class InterruptController {
public:
  explicit InterruptController(EventLog* log = nullptr);

  // Register vector in IVT
  void register_vector(std::uint8_t vector_num, InterruptType type,
                       std::string name, std::uint8_t priority,
                       InterruptHandler handler);

  // CPU Interrupt Flag (CLI / STI)
  void disable_interrupts(Tick now = 0); // cli
  void enable_interrupts(Tick now = 0);  // sti
  bool are_interrupts_enabled() const noexcept { return global_interrupt_enabled_; }

  // Individual vector mask
  void set_vector_mask(std::uint8_t vector_num, bool masked);
  bool is_vector_masked(std::uint8_t vector_num) const;

  // Raise an interrupt from hardware/software
  bool raise_interrupt(std::uint8_t vector_num, std::string source = "",
                       ProcessExecutionContext* ctx = nullptr, Tick now = 0);

  // Dispatch next eligible interrupt from pending queue
  bool dispatch_pending(ProcessExecutionContext& ctx, Tick now = 0);

  // Acknowledge completion of interrupt service routine
  void complete_interrupt(std::uint8_t vector_num, ProcessExecutionContext& ctx, Tick now = 0);

  std::size_t pending_count() const noexcept { return pending_queue_.size(); }
  std::uint8_t current_ipl() const noexcept { return current_ipl_; }

  InterruptMetrics compute_metrics() const;
  std::string to_json() const;

  void reset();

private:
  EventLog* log_ = nullptr;
  bool global_interrupt_enabled_ = true;
  std::uint8_t current_ipl_ = 255; // 255 = idle / lowest priority, 0 = highest priority
  std::vector<std::uint8_t> ipl_stack_;

  std::map<std::uint8_t, InterruptVectorEntry> ivt_;
  std::map<std::uint8_t, bool> vector_masks_;

  std::priority_queue<PendingInterrupt, std::vector<PendingInterrupt>, std::greater<PendingInterrupt>> pending_queue_;
  SequenceNo next_interrupt_seq_ = 1;

  std::size_t total_raised_ = 0;
  std::size_t total_handled_ = 0;
  std::size_t total_masked_deferred_ = 0;
  std::size_t total_nested_ = 0;
  std::size_t peak_pending_ = 0;
  std::map<std::string, std::size_t> vector_counts_;

  void initialize_default_vectors();
};

} // namespace kernellens
