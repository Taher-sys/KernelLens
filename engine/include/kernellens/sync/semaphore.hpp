#pragma once

#include "kernellens/core/types.hpp"
#include "kernellens/core/event_log.hpp"
#include <string>
#include <deque>
#include <optional>

namespace kernellens {

class SimSemaphore {
public:
  SimSemaphore(std::string id, int initial_value, EventLog* log = nullptr);

  const std::string& id() const noexcept { return id_; }
  int value() const noexcept { return value_; }
  const std::deque<ProcessId>& wait_queue() const noexcept { return wait_queue_; }

  bool wait(ProcessId pid, Tick now);
  std::optional<ProcessId> signal(Tick now);
  void reset(int initial_value);

private:
  std::string id_;
  int initial_value_ = 1;
  int value_ = 1;
  EventLog* log_ = nullptr;
  std::deque<ProcessId> wait_queue_;
};

class SimMutex {
public:
  explicit SimMutex(std::string id, EventLog* log = nullptr);

  const std::string& id() const noexcept { return sem_.id(); }
  bool is_locked() const noexcept { return sem_.value() <= 0; }
  std::optional<ProcessId> owner() const noexcept { return owner_; }

  bool lock(ProcessId pid, Tick now);
  std::optional<ProcessId> unlock(ProcessId pid, Tick now);
  void reset();

private:
  SimSemaphore sem_;
  std::optional<ProcessId> owner_ = std::nullopt;
  EventLog* log_ = nullptr;
};

} // namespace kernellens
