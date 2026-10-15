#pragma once

#include "kernellens/core/types.hpp"
#include "kernellens/core/event_log.hpp"
#include <vector>
#include <string>
#include <cstdint>
#include <optional>
#include <stdexcept>

namespace kernellens {

using PipeId = std::uint32_t;

struct PipeMetrics {
  std::size_t capacity = 512;
  std::size_t bytes_stored = 0;
  std::size_t total_written = 0;
  std::size_t total_read = 0;
  std::size_t write_operations = 0;
  std::size_t read_operations = 0;
  std::size_t broken_pipe_events = 0;
  bool read_end_open = true;
  bool write_end_open = true;

  std::string to_json() const;
};

class Pipe {
public:
  explicit Pipe(PipeId id, std::size_t capacity = 512, EventLog* log = nullptr);

  PipeId id() const noexcept { return id_; }
  std::size_t capacity() const noexcept { return capacity_; }
  std::size_t bytes_available() const noexcept { return bytes_stored_; }
  std::size_t free_space() const noexcept { return capacity_ - bytes_stored_; }
  bool is_empty() const noexcept { return bytes_stored_ == 0; }
  bool is_full() const noexcept { return bytes_stored_ >= capacity_; }

  bool is_read_open() const noexcept { return read_end_open_; }
  bool is_write_open() const noexcept { return write_end_open_; }
  bool is_broken() const noexcept { return !read_end_open_; }

  // End-point attachment
  void set_endpoints(std::optional<ProcessId> reader, std::optional<ProcessId> writer) {
    reader_pid_ = reader;
    writer_pid_ = writer;
  }
  std::optional<ProcessId> reader_pid() const noexcept { return reader_pid_; }
  std::optional<ProcessId> writer_pid() const noexcept { return writer_pid_; }

  // Write data to the pipe buffer.
  // Returns number of bytes actually written.
  // If read_end is closed, fails with broken pipe (SIGPIPE / EPIPE) and returns 0.
  std::size_t write(const std::vector<std::uint8_t>& data, ProcessId pid = 0, Tick now = 0);
  std::size_t write(const std::string& str, ProcessId pid = 0, Tick now = 0);

  // Read data from the pipe buffer.
  // If buffer is empty:
  // - If write end is open, returns empty (would block or partial read).
  // - If write end is closed, returns empty (EOF).
  std::vector<std::uint8_t> read(std::size_t max_bytes, ProcessId pid = 0, Tick now = 0);
  std::string read_string(std::size_t max_bytes, ProcessId pid = 0, Tick now = 0);

  // Close endpoints
  void close_read(ProcessId pid = 0, Tick now = 0);
  void close_write(ProcessId pid = 0, Tick now = 0);

  PipeMetrics compute_metrics() const;
  std::string to_json() const;

private:
  PipeId id_ = 0;
  std::size_t capacity_ = 512;
  EventLog* log_ = nullptr;

  std::vector<std::uint8_t> buffer_;
  std::size_t head_ = 0; // Read position
  std::size_t tail_ = 0; // Write position
  std::size_t bytes_stored_ = 0;

  bool read_end_open_ = true;
  bool write_end_open_ = true;

  std::optional<ProcessId> reader_pid_ = std::nullopt;
  std::optional<ProcessId> writer_pid_ = std::nullopt;

  std::size_t total_written_ = 0;
  std::size_t total_read_ = 0;
  std::size_t write_ops_ = 0;
  std::size_t read_ops_ = 0;
  std::size_t broken_pipe_events_ = 0;
};

} // namespace kernellens
