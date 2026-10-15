#include "kernellens/ipc/shared_memory.hpp"
#include <sstream>
#include <algorithm>

namespace kernellens {

SharedMemorySegment::SharedMemorySegment(ShmId id, std::uint32_t key, std::size_t size_bytes,
                                         EventLog* log)
    : id_(id), key_(key), size_bytes_(size_bytes > 0 ? size_bytes : 4096), log_(log),
      memory_(size_bytes_, 0) {
  if (log_) {
    std::ostringstream ss;
    ss << "{\"shmid\":" << id_ << ",\"key\":" << key_ << ",\"size_bytes\":" << size_bytes_ << "}";
    log_->emit("ipc", "ipc_shm_created", std::nullopt, 0, ss.str());
  }
}

bool SharedMemorySegment::is_attached(ProcessId pid) const {
  return attachments_.find(pid) != attachments_.end();
}

std::optional<ShmAttachment> SharedMemorySegment::get_attachment(ProcessId pid) const {
  auto it = attachments_.find(pid);
  if (it != attachments_.end()) return it->second;
  return std::nullopt;
}

bool SharedMemorySegment::attach(ProcessId pid, std::uint64_t virtual_address,
                                 ShmPermission perm, Tick now) {
  ShmAttachment att;
  att.pid = pid;
  att.virtual_address = virtual_address;
  att.permission = perm;
  att.attached_at = now;
  attachments_[pid] = att;

  if (log_) {
    std::ostringstream ss;
    ss << "{\"shmid\":" << id_
       << ",\"vaddr\":" << virtual_address
       << ",\"permission\":\"" << to_string(perm)
       << "\",\"attached_count\":" << attachments_.size() << "}";
    log_->emit("ipc", "ipc_shm_attached", pid, now, ss.str());
  }

  return true;
}

bool SharedMemorySegment::detach(ProcessId pid, Tick now) {
  auto it = attachments_.find(pid);
  if (it == attachments_.end()) return false;

  attachments_.erase(it);

  if (log_) {
    std::ostringstream ss;
    ss << "{\"shmid\":" << id_
       << ",\"attached_count\":" << attachments_.size()
       << ",\"marked_for_deletion\":" << (marked_for_deletion_ ? "true" : "false") << "}";
    log_->emit("ipc", "ipc_shm_detached", pid, now, ss.str());
  }

  return true;
}

void SharedMemorySegment::mark_for_deletion(Tick now) {
  marked_for_deletion_ = true;
  if (log_) {
    std::ostringstream ss;
    ss << "{\"shmid\":" << id_ << ",\"attached_count\":" << attachments_.size() << "}";
    log_->emit("ipc", "ipc_shm_marked_deletion", std::nullopt, now, ss.str());
  }
}

bool SharedMemorySegment::write(ProcessId pid, std::size_t offset,
                                const std::vector<std::uint8_t>& data,
                                std::optional<std::uint32_t> lock_id, Tick now) {
  write_ops_++;
  auto it = attachments_.find(pid);
  if (it == attachments_.end()) {
    return false; // Not attached
  }
  if (it->second.permission != ShmPermission::ReadWrite) {
    if (log_) {
      std::ostringstream ss;
      ss << "{\"shmid\":" << id_ << ",\"error\":\"EACCES\",\"reason\":\"SEGMENT_READ_ONLY\"}";
      log_->emit("ipc", "ipc_shm_permission_denied", pid, now, ss.str());
    }
    return false;
  }
  if (offset + data.size() > size_bytes_) {
    return false; // Buffer overflow
  }

  // Race condition detector:
  // If concurrent write occurs at the exact same tick or without a synchronization primitive
  if (!lock_id.has_value() && attachments_.size() > 1) {
    if (last_writer_pid_.has_value() && last_writer_pid_.value() != pid && last_write_tick_ == now) {
      race_conditions_++;
      if (log_) {
        std::ostringstream ss;
        ss << "{\"shmid\":" << id_
           << ",\"hazard\":\"WRITE_AFTER_WRITE_RACE\""
           << ",\"concurrent_writer_pid\":" << last_writer_pid_.value()
           << ",\"current_writer_pid\":" << pid
           << ",\"offset\":" << offset
           << ",\"unprotected\":true}";
        log_->emit("ipc", "ipc_shm_race_detected", pid, now, ss.str());
      }
    }
  }

  for (std::size_t i = 0; i < data.size(); ++i) {
    memory_[offset + i] = data[i];
  }

  last_writer_pid_ = pid;
  last_write_tick_ = now;

  if (log_) {
    std::ostringstream ss;
    ss << "{\"shmid\":" << id_
       << ",\"offset\":" << offset
       << ",\"bytes_written\":" << data.size()
       << ",\"lock_id\":" << (lock_id.has_value() ? std::to_string(lock_id.value()) : "null") << "}";
    log_->emit("ipc", "ipc_shm_written", pid, now, ss.str());
  }

  return true;
}

bool SharedMemorySegment::write(ProcessId pid, std::size_t offset, const std::string& str,
                                std::optional<std::uint32_t> lock_id, Tick now) {
  std::vector<std::uint8_t> data(str.begin(), str.end());
  return write(pid, offset, data, lock_id, now);
}

std::vector<std::uint8_t> SharedMemorySegment::read(ProcessId pid, std::size_t offset,
                                                    std::size_t length,
                                                    std::optional<std::uint32_t> lock_id, Tick now) {
  read_ops_++;
  auto it = attachments_.find(pid);
  if (it == attachments_.end()) return {};
  if (offset >= size_bytes_) return {};

  std::size_t read_len = std::min(length, size_bytes_ - offset);
  std::vector<std::uint8_t> result(read_len);
  for (std::size_t i = 0; i < read_len; ++i) {
    result[i] = memory_[offset + i];
  }

  if (log_) {
    std::ostringstream ss;
    ss << "{\"shmid\":" << id_
       << ",\"offset\":" << offset
       << ",\"bytes_read\":" << read_len
       << ",\"lock_id\":" << (lock_id.has_value() ? std::to_string(lock_id.value()) : "null") << "}";
    log_->emit("ipc", "ipc_shm_read", pid, now, ss.str());
  }

  return result;
}

std::string SharedMemorySegment::read_string(ProcessId pid, std::size_t offset,
                                             std::size_t length,
                                             std::optional<std::uint32_t> lock_id, Tick now) {
  auto bytes = read(pid, offset, length, lock_id, now);
  return std::string(bytes.begin(), bytes.end());
}

ShmMetrics SharedMemorySegment::compute_metrics() const {
  ShmMetrics m;
  m.shmid = id_;
  m.key = key_;
  m.size_bytes = size_bytes_;
  m.attached_count = attachments_.size();
  m.write_operations = write_ops_;
  m.read_operations = read_ops_;
  m.race_conditions_detected = race_conditions_;
  m.marked_for_deletion = marked_for_deletion_;
  return m;
}

std::string ShmMetrics::to_json() const {
  std::ostringstream ss;
  ss << "{"
     << "\"shmid\":" << shmid << ","
     << "\"key\":" << key << ","
     << "\"size_bytes\":" << size_bytes << ","
     << "\"attached_count\":" << attached_count << ","
     << "\"write_operations\":" << write_operations << ","
     << "\"read_operations\":" << read_operations << ","
     << "\"race_conditions_detected\":" << race_conditions_detected << ","
     << "\"marked_for_deletion\":" << (marked_for_deletion ? "true" : "false")
     << "}";
  return ss.str();
}

std::string SharedMemorySegment::to_json() const {
  std::ostringstream ss;
  ss << "{"
     << "\"shmid\":" << id_ << ","
     << "\"key\":" << key_ << ","
     << "\"metrics\":" << compute_metrics().to_json()
     << "}";
  return ss.str();
}

} // namespace kernellens
