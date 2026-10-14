#pragma once

#include "kernellens/core/event.hpp"
#include <vector>
#include <string>

namespace kernellens {

class EventLog {
public:
  explicit EventLog(std::string run_id = "default");

  void emit(std::string subsystem, std::string type, std::optional<ProcessId> pid,
            Tick time, std::string details_json);

  const std::vector<SimEvent>& events() const noexcept { return events_; }
  std::size_t size() const noexcept { return events_.size(); }
  void clear();

  std::string to_json() const;
  std::string to_ndjson() const;

private:
  std::string run_id_;
  SequenceNo current_seq_ = 0;
  std::vector<SimEvent> events_;
};

} // namespace kernellens
