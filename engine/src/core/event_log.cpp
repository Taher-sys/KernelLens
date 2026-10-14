#include "kernellens/core/event_log.hpp"
#include <sstream>

namespace kernellens {

EventLog::EventLog(std::string run_id) : run_id_(std::move(run_id)) {}

void EventLog::emit(std::string subsystem, std::string type, std::optional<ProcessId> pid,
                    Tick time, std::string details_json) {
  SimEvent evt;
  evt.schema_version = 1;
  evt.run_id = run_id_;
  evt.seq = current_seq_++;
  evt.time = time;
  evt.subsystem = std::move(subsystem);
  evt.type = std::move(type);
  evt.pid = pid;
  evt.details_json = std::move(details_json);

  events_.push_back(std::move(evt));
}

void EventLog::clear() {
  current_seq_ = 0;
  events_.clear();
}

static std::string format_event_json(const SimEvent& e) {
  std::ostringstream ss;
  ss << "{"
     << "\"schemaVersion\":" << e.schema_version << ","
     << "\"runId\":\"" << e.run_id << "\","
     << "\"seq\":" << e.seq << ","
     << "\"time\":" << e.time << ","
     << "\"subsystem\":\"" << e.subsystem << "\","
     << "\"type\":\"" << e.type << "\",";
  if (e.pid.has_value()) {
    ss << "\"pid\":" << *e.pid << ",";
  } else {
    ss << "\"pid\":null,";
  }
  ss << "\"details\":" << (e.details_json.empty() ? "{}" : e.details_json)
     << "}";
  return ss.str();
}

std::string EventLog::to_json() const {
  std::ostringstream ss;
  ss << "[";
  for (std::size_t i = 0; i < events_.size(); ++i) {
    if (i > 0) ss << ",";
    ss << format_event_json(events_[i]);
  }
  ss << "]";
  return ss.str();
}

std::string EventLog::to_ndjson() const {
  std::ostringstream ss;
  for (const auto& e : events_) {
    ss << format_event_json(e) << "\n";
  }
  return ss.str();
}

} // namespace kernellens
