#pragma once

#include "kernellens/core/types.hpp"
#include "kernellens/core/event_log.hpp"
#include <vector>
#include <string>
#include <cstdint>
#include <optional>
#include <deque>

namespace kernellens {

using MqId = std::uint32_t;

struct MqMessage {
  std::uint64_t id = 0;
  ProcessId sender_pid = 0;
  std::int64_t msg_type = 1;      // Multiplexing category/channel
  std::uint32_t priority = 0;     // Higher integer = higher delivery priority
  std::string payload;
  Tick sent_at = 0;

  std::string to_json() const;
};

struct MqMetrics {
  std::size_t max_msgs = 10;
  std::size_t max_msg_size = 256;
  std::size_t current_msgs = 0;
  std::size_t peak_msgs = 0;
  std::size_t total_sent = 0;
  std::size_t total_received = 0;
  std::size_t dropped_or_rejected = 0;

  std::string to_json() const;
};

class MessageQueue {
public:
  explicit MessageQueue(MqId id, std::string name, std::size_t max_msgs = 10,
                        std::size_t max_msg_size = 256, EventLog* log = nullptr);

  MqId id() const noexcept { return id_; }
  const std::string& name() const noexcept { return name_; }
  std::size_t size() const noexcept { return messages_.size(); }
  std::size_t max_msgs() const noexcept { return max_msgs_; }
  std::size_t max_msg_size() const noexcept { return max_msg_size_; }

  bool is_empty() const noexcept { return messages_.empty(); }
  bool is_full() const noexcept { return messages_.size() >= max_msgs_; }

  // Send message. Returns true if queued, false if queue full or payload too large.
  bool send(ProcessId sender_pid, std::int64_t msg_type, std::uint32_t priority,
            const std::string& payload, Tick now = 0);

  // Receive message by filter type (0 = any highest priority, >0 = exact type, <0 = <= abs(type))
  std::optional<MqMessage> receive(ProcessId receiver_pid, std::int64_t filter_type = 0, Tick now = 0);

  // Peek message without removing
  std::optional<MqMessage> peek(std::int64_t filter_type = 0) const;

  MqMetrics compute_metrics() const;
  std::string to_json() const;

private:
  MqId id_ = 0;
  std::string name_;
  std::size_t max_msgs_ = 10;
  std::size_t max_msg_size_ = 256;
  EventLog* log_ = nullptr;

  std::uint64_t next_msg_id_ = 1;
  // Messages ordered by (priority DESC, id ASC)
  std::vector<MqMessage> messages_;

  std::size_t peak_msgs_ = 0;
  std::size_t total_sent_ = 0;
  std::size_t total_received_ = 0;
  std::size_t dropped_or_rejected_ = 0;

  void insert_sorted(const MqMessage& msg);
};

} // namespace kernellens
