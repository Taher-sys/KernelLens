#include "kernellens/ipc/ipc_manager.hpp"
#include <sstream>

namespace kernellens {

IpcManager::IpcManager(EventLog* log) : log_(log) {}

PipeId IpcManager::create_pipe(std::size_t capacity, std::optional<ProcessId> reader,
                               std::optional<ProcessId> writer, Tick now) {
  (void)now;
  PipeId id = next_pipe_id_++;
  auto pipe = std::make_unique<Pipe>(id, capacity, log_);
  pipe->set_endpoints(reader, writer);
  pipes_[id] = std::move(pipe);
  return id;
}

Pipe* IpcManager::get_pipe(PipeId id) {
  auto it = pipes_.find(id);
  if (it != pipes_.end()) return it->second.get();
  return nullptr;
}

const Pipe* IpcManager::get_pipe(PipeId id) const {
  auto it = pipes_.find(id);
  if (it != pipes_.end()) return it->second.get();
  return nullptr;
}

bool IpcManager::close_pipe_read(PipeId id, ProcessId pid, Tick now) {
  auto* pipe = get_pipe(id);
  if (!pipe) return false;
  pipe->close_read(pid, now);
  return true;
}

bool IpcManager::close_pipe_write(PipeId id, ProcessId pid, Tick now) {
  auto* pipe = get_pipe(id);
  if (!pipe) return false;
  pipe->close_write(pid, now);
  return true;
}

MqId IpcManager::create_mq(std::string name, std::size_t max_msgs,
                           std::size_t max_msg_size, Tick now) {
  (void)now;
  MqId id = next_mq_id_++;
  auto mq = std::make_unique<MessageQueue>(id, std::move(name), max_msgs, max_msg_size, log_);
  mqs_[id] = std::move(mq);
  return id;
}

MessageQueue* IpcManager::get_mq(MqId id) {
  auto it = mqs_.find(id);
  if (it != mqs_.end()) return it->second.get();
  return nullptr;
}

const MessageQueue* IpcManager::get_mq(MqId id) const {
  auto it = mqs_.find(id);
  if (it != mqs_.end()) return it->second.get();
  return nullptr;
}

MessageQueue* IpcManager::get_mq_by_name(const std::string& name) {
  for (auto& pair : mqs_) {
    if (pair.second->name() == name) return pair.second.get();
  }
  return nullptr;
}

ShmId IpcManager::create_shm(std::uint32_t key, std::size_t size_bytes, Tick now) {
  (void)now;
  ShmId id = next_shm_id_++;
  auto shm = std::make_unique<SharedMemorySegment>(id, key, size_bytes, log_);
  shm_segments_[id] = std::move(shm);
  return id;
}

SharedMemorySegment* IpcManager::get_shm(ShmId id) {
  auto it = shm_segments_.find(id);
  if (it != shm_segments_.end()) return it->second.get();
  return nullptr;
}

const SharedMemorySegment* IpcManager::get_shm(ShmId id) const {
  auto it = shm_segments_.find(id);
  if (it != shm_segments_.end()) return it->second.get();
  return nullptr;
}

SharedMemorySegment* IpcManager::get_shm_by_key(std::uint32_t key) {
  for (auto& pair : shm_segments_) {
    if (pair.second->key() == key) return pair.second.get();
  }
  return nullptr;
}

IpcSubsystemMetrics IpcManager::compute_metrics() const {
  IpcSubsystemMetrics m;
  m.total_pipes = pipes_.size();
  for (const auto& p : pipes_) {
    if (p.second->is_read_open() || p.second->is_write_open()) {
      m.active_pipes++;
    }
  }
  m.total_message_queues = mqs_.size();
  for (const auto& mq : mqs_) {
    m.total_messages_queued += mq.second->size();
  }
  m.total_shm_segments = shm_segments_.size();
  for (const auto& shm : shm_segments_) {
    m.total_shm_bytes += shm.second->size();
    m.total_race_conditions += shm.second->compute_metrics().race_conditions_detected;
  }
  return m;
}

std::string IpcSubsystemMetrics::to_json() const {
  std::ostringstream ss;
  ss << "{"
     << "\"total_pipes\":" << total_pipes << ","
     << "\"active_pipes\":" << active_pipes << ","
     << "\"total_message_queues\":" << total_message_queues << ","
     << "\"total_messages_queued\":" << total_messages_queued << ","
     << "\"total_shm_segments\":" << total_shm_segments << ","
     << "\"total_shm_bytes\":" << total_shm_bytes << ","
     << "\"total_race_conditions\":" << total_race_conditions
     << "}";
  return ss.str();
}

std::string IpcManager::to_json() const {
  std::ostringstream ss;
  ss << "{"
     << "\"metrics\":" << compute_metrics().to_json() << ","
     << "\"pipes\":[";
  bool first = true;
  for (const auto& p : pipes_) {
    if (!first) ss << ",";
    first = false;
    ss << p.second->to_json();
  }
  ss << "],\"message_queues\":[";
  first = true;
  for (const auto& mq : mqs_) {
    if (!first) ss << ",";
    first = false;
    ss << mq.second->to_json();
  }
  ss << "],\"shared_memory\":[";
  first = true;
  for (const auto& shm : shm_segments_) {
    if (!first) ss << ",";
    first = false;
    ss << shm.second->to_json();
  }
  ss << "]}";
  return ss.str();
}

void IpcManager::reset() {
  pipes_.clear();
  mqs_.clear();
  shm_segments_.clear();
  next_pipe_id_ = 1;
  next_mq_id_ = 1;
  next_shm_id_ = 1;
}

} // namespace kernellens
