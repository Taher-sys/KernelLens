#include "kernellens/core/clock.hpp"
#include <stdexcept>

namespace kernellens {

Tick SimClock::next_event_time() const {
  if (queue_.empty()) {
    return current_tick_;
  }
  return queue_.top().key.time;
}

void SimClock::schedule(Tick time, EventPriority priority, std::string description, ActionCallback action) {
  if (time < current_tick_) {
    throw std::invalid_argument("Cannot schedule event in the past: time=" + std::to_string(time) +
                                ", current=" + std::to_string(current_tick_));
  }
  EventKey key{time, priority, ++insertion_sequence_};
  queue_.push(ScheduledEvent{key, std::move(description), std::move(action)});
}

bool SimClock::step() {
  if (queue_.empty()) {
    return false;
  }
  ScheduledEvent event = queue_.top();
  queue_.pop();

  // Monotonic time advance
  if (event.key.time > current_tick_) {
    current_tick_ = event.key.time;
  }

  if (event.action) {
    event.action(current_tick_);
  }
  return true;
}

void SimClock::advance_to(Tick target_time) {
  if (target_time < current_tick_) {
    throw std::invalid_argument("Cannot advance clock backwards");
  }
  while (!queue_.empty() && queue_.top().key.time <= target_time) {
    step();
  }
  current_tick_ = target_time;
}

void SimClock::reset() {
  current_tick_ = 0;
  insertion_sequence_ = 0;
  while (!queue_.empty()) {
    queue_.pop();
  }
}

} // namespace kernellens
