#pragma once

#include "kernellens/core/types.hpp"
#include <string>
#include <map>
#include <variant>
#include <functional>

namespace kernellens {

enum class EventPriority : int {
  High = 0,    // Hardware interrupts, context switches, IO completions
  Normal = 1,  // Process arrivals, ready queue admissions
  Low = 2      // Scheduler decisions, quantum expirations, yield
};

struct SimEvent {
  std::uint32_t schema_version = 1;
  std::string run_id = "default";
  SequenceNo seq = 0;
  Tick time = 0;
  std::string subsystem; // cpu, memory, sync, disk, filesystem, system
  std::string type;      // process_arrived, dispatch, preempt, etc.
  std::optional<ProcessId> pid = std::nullopt;
  std::string details_json = "{}";
};

struct EventKey {
  Tick time = 0;
  EventPriority priority = EventPriority::Normal;
  SequenceNo insertion_seq = 0;

  bool operator>(const EventKey& other) const {
    if (time != other.time) return time > other.time;
    if (priority != other.priority) return static_cast<int>(priority) > static_cast<int>(other.priority);
    return insertion_seq > other.insertion_seq;
  }
};

using ActionCallback = std::function<void(Tick)>;

struct ScheduledEvent {
  EventKey key;
  std::string description;
  ActionCallback action;
};

struct ScheduledEventComparator {
  bool operator()(const ScheduledEvent& a, const ScheduledEvent& b) const {
    return a.key > b.key;
  }
};

} // namespace kernellens
