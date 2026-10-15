#include "kernellens/ipc/message_queue.hpp"
#include <sstream>
#include <algorithm>

namespace kernellens {

MessageQueue::MessageQueue(MqId id, std::string name, std::size_t max_msgs,
                           std::size_t max_msg_size, EventLog* log)
    : id_(id), name_(std::move(name)), max_msgs_(max_msgs > 0 ? max_msgs : 10),
      max_msg_size_(max_msg_size > 0 ? max_msg_size : 256), log_(log) {
  if (log_) {
    std::ostringstream ss;
    ss << "{\"mq_id\":" << id_ << ",\"name\":\"" << name_
       << "\",\"max_msgs\":" << max_msgs_
       << ",\"max_msg_size\":" << max_msg_size_ << "}";
    log_->emit("ipc", "ipc_mq_created", std::nullopt, 0, ss.str());
  }
}

void MessageQueue::insert_sorted(const MqMessage& msg) {
  // Ordered by priority descending, then id ascending (FIFO for equal priority)
  auto it = std::upper_bound(messages_.begin(), messages_.end(), msg,
    [](const MqMessage& a, const MqMessage& b) {
      if (a.priority != b.priority) {
        return a.priority > b.priority;
      }
      return a.id < b.id;
    });
  messages_.insert(it, msg);
}

bool MessageQueue::send(ProcessId sender_pid, std::int64_t msg_type, std::uint32_t priority,
                        const std::string& payload, Tick now) {
  if (payload.size() > max_msg_size_ || messages_.size() >= max_msgs_) {
    dropped_or_rejected_++;
    if (log_) {
      std::ostringstream ss;
      ss << "{\"mq_id\":" << id_ << ",\"name\":\"" << name_
         << "\",\"reason\":\"" << (messages_.size() >= max_msgs_ ? "QUEUE_FULL" : "MSG_TOO_LARGE")
         << "\",\"current_size\":" << messages_.size()
         << ",\"payload_size\":" << payload.size() << "}";
      log_->emit("ipc", "ipc_mq_full", sender_pid, now, ss.str());
    }
    return false;
  }

  MqMessage msg;
  msg.id = next_msg_id_++;
  msg.sender_pid = sender_pid;
  msg.msg_type = msg_type;
  msg.priority = priority;
  msg.payload = payload;
  msg.sent_at = now;

  insert_sorted(msg);
  total_sent_++;
  if (messages_.size() > peak_msgs_) {
    peak_msgs_ = messages_.size();
  }

  if (log_) {
    std::ostringstream ss;
    ss << "{\"mq_id\":" << id_
       << ",\"msg_id\":" << msg.id
       << ",\"msg_type\":" << msg.msg_type
       << ",\"priority\":" << msg.priority
       << ",\"queue_size\":" << messages_.size() << "}";
    log_->emit("ipc", "ipc_mq_sent", sender_pid, now, ss.str());
  }

  return true;
}

std::optional<MqMessage> MessageQueue::receive(ProcessId receiver_pid, std::int64_t filter_type, Tick now) {
  if (messages_.empty()) {
    return std::nullopt;
  }

  auto it = messages_.end();

  if (filter_type == 0) {
    // Pick highest priority front
    it = messages_.begin();
  } else if (filter_type > 0) {
    // Pick first matching exact type
    for (auto cur = messages_.begin(); cur != messages_.end(); ++cur) {
      if (cur->msg_type == filter_type) {
        it = cur;
        break;
      }
    }
  } else {
    // filter_type < 0: lowest msg_type <= abs(filter_type)
    std::int64_t bound = -filter_type;
    std::int64_t min_type = bound + 1;
    for (auto cur = messages_.begin(); cur != messages_.end(); ++cur) {
      if (cur->msg_type <= bound) {
        if (cur->msg_type < min_type) {
          min_type = cur->msg_type;
          it = cur;
        }
      }
    }
  }

  if (it == messages_.end()) {
    return std::nullopt;
  }

  MqMessage result = *it;
  messages_.erase(it);
  total_received_++;

  if (log_) {
    std::ostringstream ss;
    ss << "{\"mq_id\":" << id_
       << ",\"msg_id\":" << result.id
       << ",\"msg_type\":" << result.msg_type
       << ",\"priority\":" << result.priority
       << ",\"sender_pid\":" << result.sender_pid
       << ",\"remaining_size\":" << messages_.size() << "}";
    log_->emit("ipc", "ipc_mq_received", receiver_pid, now, ss.str());
  }

  return result;
}

std::optional<MqMessage> MessageQueue::peek(std::int64_t filter_type) const {
  if (messages_.empty()) return std::nullopt;

  if (filter_type == 0) {
    return messages_.front();
  } else if (filter_type > 0) {
    for (const auto& m : messages_) {
      if (m.msg_type == filter_type) return m;
    }
  } else {
    std::int64_t bound = -filter_type;
    std::int64_t min_type = bound + 1;
    std::optional<MqMessage> best = std::nullopt;
    for (const auto& m : messages_) {
      if (m.msg_type <= bound && m.msg_type < min_type) {
        min_type = m.msg_type;
        best = m;
      }
    }
    return best;
  }
  return std::nullopt;
}

MqMetrics MessageQueue::compute_metrics() const {
  MqMetrics m;
  m.max_msgs = max_msgs_;
  m.max_msg_size = max_msg_size_;
  m.current_msgs = messages_.size();
  m.peak_msgs = peak_msgs_;
  m.total_sent = total_sent_;
  m.total_received = total_received_;
  m.dropped_or_rejected = dropped_or_rejected_;
  return m;
}

std::string MqMessage::to_json() const {
  std::ostringstream ss;
  ss << "{"
     << "\"id\":" << id << ","
     << "\"sender_pid\":" << sender_pid << ","
     << "\"msg_type\":" << msg_type << ","
     << "\"priority\":" << priority << ","
     << "\"payload\":\"" << payload << "\","
     << "\"sent_at\":" << sent_at
     << "}";
  return ss.str();
}

std::string MqMetrics::to_json() const {
  std::ostringstream ss;
  ss << "{"
     << "\"max_msgs\":" << max_msgs << ","
     << "\"max_msg_size\":" << max_msg_size << ","
     << "\"current_msgs\":" << current_msgs << ","
     << "\"peak_msgs\":" << peak_msgs << ","
     << "\"total_sent\":" << total_sent << ","
     << "\"total_received\":" << total_received << ","
     << "\"dropped_or_rejected\":" << dropped_or_rejected
     << "}";
  return ss.str();
}

std::string MessageQueue::to_json() const {
  std::ostringstream ss;
  ss << "{"
     << "\"mq_id\":" << id_ << ","
     << "\"name\":\"" << name_ << "\","
     << "\"metrics\":" << compute_metrics().to_json()
     << "}";
  return ss.str();
}

} // namespace kernellens
