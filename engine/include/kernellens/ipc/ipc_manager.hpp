#pragma once

#include "kernellens/ipc/pipe.hpp"
#include "kernellens/ipc/message_queue.hpp"
#include "kernellens/ipc/shared_memory.hpp"
#include "kernellens/core/event_log.hpp"
#include <map>
#include <memory>
#include <string>
#include <vector>
#include <optional>

namespace kernellens {

struct IpcSubsystemMetrics {
  std::size_t total_pipes = 0;
  std::size_t active_pipes = 0;
  std::size_t total_message_queues = 0;
  std::size_t total_messages_queued = 0;
  std::size_t total_shm_segments = 0;
  std::size_t total_shm_bytes = 0;
  std::size_t total_race_conditions = 0;

  std::string to_json() const;
};

class IpcManager {
public:
  explicit IpcManager(EventLog* log = nullptr);

  // Pipe Management
  PipeId create_pipe(std::size_t capacity = 512,
                     std::optional<ProcessId> reader = std::nullopt,
                     std::optional<ProcessId> writer = std::nullopt,
                     Tick now = 0);
  Pipe* get_pipe(PipeId id);
  const Pipe* get_pipe(PipeId id) const;
  bool close_pipe_read(PipeId id, ProcessId pid = 0, Tick now = 0);
  bool close_pipe_write(PipeId id, ProcessId pid = 0, Tick now = 0);

  // Message Queue Management
  MqId create_mq(std::string name, std::size_t max_msgs = 10,
                 std::size_t max_msg_size = 256, Tick now = 0);
  MessageQueue* get_mq(MqId id);
  const MessageQueue* get_mq(MqId id) const;
  MessageQueue* get_mq_by_name(const std::string& name);

  // Shared Memory Management
  ShmId create_shm(std::uint32_t key, std::size_t size_bytes, Tick now = 0);
  SharedMemorySegment* get_shm(ShmId id);
  const SharedMemorySegment* get_shm(ShmId id) const;
  SharedMemorySegment* get_shm_by_key(std::uint32_t key);

  IpcSubsystemMetrics compute_metrics() const;
  std::string to_json() const;

  void reset();

private:
  EventLog* log_ = nullptr;
  PipeId next_pipe_id_ = 1;
  MqId next_mq_id_ = 1;
  ShmId next_shm_id_ = 1;

  std::map<PipeId, std::unique_ptr<Pipe>> pipes_;
  std::map<MqId, std::unique_ptr<MessageQueue>> mqs_;
  std::map<ShmId, std::unique_ptr<SharedMemorySegment>> shm_segments_;
};

} // namespace kernellens
