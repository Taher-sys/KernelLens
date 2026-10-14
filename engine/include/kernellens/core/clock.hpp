#pragma once

#include "kernellens/core/types.hpp"
#include "kernellens/core/event.hpp"
#include <queue>
#include <vector>
#include <functional>

namespace kernellens {

class SimClock {
public:
  SimClock() = default;

  Tick now() const noexcept { return current_tick_; }
  bool has_events() const noexcept { return !queue_.empty(); }
  std::size_t pending_event_count() const noexcept { return queue_.size(); }
  Tick next_event_time() const;

  void schedule(Tick time, EventPriority priority, std::string description, ActionCallback action);
  bool step();
  void advance_to(Tick target_time);
  void reset();

private:
  Tick current_tick_ = 0;
  SequenceNo insertion_sequence_ = 0;
  std::priority_queue<ScheduledEvent, std::vector<ScheduledEvent>, ScheduledEventComparator> queue_;
};

} // namespace kernellens
