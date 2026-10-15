#pragma once

#include "kernellens/core/types.hpp"
#include "kernellens/core/event_log.hpp"
#include <vector>
#include <string>
#include <map>
#include <cstdint>
#include <optional>

namespace kernellens {

using ShmId = std::uint32_t;

enum class ShmPermission {
  ReadOnly,
  ReadWrite
};

inline std::string to_string(ShmPermission perm) {
  return perm == ShmPermission::ReadOnly ? "READ_ONLY" : "READ_WRITE";
}

struct ShmAttachment {
  ProcessId pid = 0;
  std::uint64_t virtual_address = 0;
  ShmPermission permission = ShmPermission::ReadWrite;
  Tick attached_at = 0;
};

struct ShmMetrics {
  ShmId shmid = 0;
  std::uint32_t key = 0;
  std::size_t size_bytes = 0;
  std::size_t attached_count = 0;
  std::size_t write_operations = 0;
  std::size_t read_operations = 0;
  std::size_t race_conditions_detected = 0;
  bool marked_for_deletion = false;

  std::string to_json() const;
};

class SharedMemorySegment {
public:
  explicit SharedMemorySegment(ShmId id, std::uint32_t key, std::size_t size_bytes,
                               EventLog* log = nullptr);

  ShmId id() const noexcept { return id_; }
  std::uint32_t key() const noexcept { return key_; }
  std::size_t size() const noexcept { return size_bytes_; }
  std::size_t attached_count() const noexcept { return attachments_.size(); }
  bool is_marked_for_deletion() const noexcept { return marked_for_deletion_; }

  bool is_attached(ProcessId pid) const;
  std::optional<ShmAttachment> get_attachment(ProcessId pid) const;

  // Attach process to segment
  bool attach(ProcessId pid, std::uint64_t virtual_address, ShmPermission perm, Tick now = 0);

  // Detach process
  bool detach(ProcessId pid, Tick now = 0);

  // Mark for deletion (IPC_RMID). Segment will be destroyed once attached_count reaches 0.
  void mark_for_deletion(Tick now = 0);

  // Write to shared memory. If lock_id is nullopt, detects concurrent race conditions.
  bool write(ProcessId pid, std::size_t offset, const std::vector<std::uint8_t>& data,
             std::optional<std::uint32_t> lock_id = std::nullopt, Tick now = 0);
  bool write(ProcessId pid, std::size_t offset, const std::string& str,
             std::optional<std::uint32_t> lock_id = std::nullopt, Tick now = 0);

  // Read from shared memory.
  std::vector<std::uint8_t> read(ProcessId pid, std::size_t offset, std::size_t length,
                                 std::optional<std::uint32_t> lock_id = std::nullopt, Tick now = 0);
  std::string read_string(ProcessId pid, std::size_t offset, std::size_t length,
                          std::optional<std::uint32_t> lock_id = std::nullopt, Tick now = 0);

  ShmMetrics compute_metrics() const;
  std::string to_json() const;

private:
  ShmId id_ = 0;
  std::uint32_t key_ = 0;
  std::size_t size_bytes_ = 0;
  EventLog* log_ = nullptr;

  std::vector<std::uint8_t> memory_;
  std::map<ProcessId, ShmAttachment> attachments_;
  bool marked_for_deletion_ = false;

  // Race detector state
  std::optional<ProcessId> last_writer_pid_ = std::nullopt;
  Tick last_write_tick_ = -1;
  std::size_t write_ops_ = 0;
  std::size_t read_ops_ = 0;
  std::size_t race_conditions_ = 0;
};

} // namespace kernellens
