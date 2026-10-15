#include "kernellens/ipc/pipe.hpp"
#include <sstream>
#include <algorithm>

namespace kernellens {

Pipe::Pipe(PipeId id, std::size_t capacity, EventLog* log)
    : id_(id), capacity_(capacity > 0 ? capacity : 512), log_(log), buffer_(capacity_, 0) {
  if (log_) {
    std::ostringstream ss;
    ss << "{\"pipe_id\":" << id_ << ",\"capacity\":" << capacity_ << "}";
    log_->emit("ipc", "ipc_pipe_created", std::nullopt, 0, ss.str());
  }
}

std::size_t Pipe::write(const std::vector<std::uint8_t>& data, ProcessId pid, Tick now) {
  write_ops_++;

  // Broken pipe check: if reader end is closed, writing causes EPIPE / SIGPIPE
  if (!read_end_open_) {
    broken_pipe_events_++;
    if (log_) {
      std::ostringstream ss;
      ss << "{\"pipe_id\":" << id_ << ",\"error\":\"EPIPE\",\"signal\":\"SIGPIPE\",\"bytes_attempted\":" << data.size() << "}";
      log_->emit("ipc", "ipc_pipe_broken", pid, now, ss.str());
    }
    return 0;
  }

  if (data.empty()) return 0;

  std::size_t bytes_to_write = std::min(data.size(), free_space());
  for (std::size_t i = 0; i < bytes_to_write; ++i) {
    buffer_[tail_] = data[i];
    tail_ = (tail_ + 1) % capacity_;
  }
  bytes_stored_ += bytes_to_write;
  total_written_ += bytes_to_write;

  if (log_) {
    std::ostringstream ss;
    ss << "{\"pipe_id\":" << id_
       << ",\"bytes_written\":" << bytes_to_write
       << ",\"bytes_stored\":" << bytes_stored_
       << ",\"free_space\":" << free_space()
       << ",\"partial\":" << (bytes_to_write < data.size() ? "true" : "false") << "}";
    log_->emit("ipc", "ipc_pipe_written", pid, now, ss.str());
  }

  return bytes_to_write;
}

std::size_t Pipe::write(const std::string& str, ProcessId pid, Tick now) {
  std::vector<std::uint8_t> data(str.begin(), str.end());
  return write(data, pid, now);
}

std::vector<std::uint8_t> Pipe::read(std::size_t max_bytes, ProcessId pid, Tick now) {
  read_ops_++;
  if (max_bytes == 0 || bytes_stored_ == 0) {
    if (log_ && bytes_stored_ == 0 && !write_end_open_) {
      std::ostringstream ss;
      ss << "{\"pipe_id\":" << id_ << ",\"status\":\"EOF\"}";
      log_->emit("ipc", "ipc_pipe_eof", pid, now, ss.str());
    }
    return {};
  }

  std::size_t bytes_to_read = std::min(max_bytes, bytes_stored_);
  std::vector<std::uint8_t> result(bytes_to_read);

  for (std::size_t i = 0; i < bytes_to_read; ++i) {
    result[i] = buffer_[head_];
    head_ = (head_ + 1) % capacity_;
  }
  bytes_stored_ -= bytes_to_read;
  total_read_ += bytes_to_read;

  if (log_) {
    std::ostringstream ss;
    ss << "{\"pipe_id\":" << id_
       << ",\"bytes_read\":" << bytes_to_read
       << ",\"bytes_remaining\":" << bytes_stored_ << "}";
    log_->emit("ipc", "ipc_pipe_read", pid, now, ss.str());
  }

  return result;
}

std::string Pipe::read_string(std::size_t max_bytes, ProcessId pid, Tick now) {
  auto bytes = read(max_bytes, pid, now);
  return std::string(bytes.begin(), bytes.end());
}

void Pipe::close_read(ProcessId pid, Tick now) {
  if (!read_end_open_) return;
  read_end_open_ = false;
  if (log_) {
    std::ostringstream ss;
    ss << "{\"pipe_id\":" << id_ << ",\"end\":\"read\"}";
    log_->emit("ipc", "ipc_pipe_closed", pid, now, ss.str());
  }
}

void Pipe::close_write(ProcessId pid, Tick now) {
  if (!write_end_open_) return;
  write_end_open_ = false;
  if (log_) {
    std::ostringstream ss;
    ss << "{\"pipe_id\":" << id_ << ",\"end\":\"write\",\"remaining_bytes\":" << bytes_stored_ << "}";
    log_->emit("ipc", "ipc_pipe_closed", pid, now, ss.str());
  }
}

PipeMetrics Pipe::compute_metrics() const {
  PipeMetrics m;
  m.capacity = capacity_;
  m.bytes_stored = bytes_stored_;
  m.total_written = total_written_;
  m.total_read = total_read_;
  m.write_operations = write_ops_;
  m.read_operations = read_ops_;
  m.broken_pipe_events = broken_pipe_events_;
  m.read_end_open = read_end_open_;
  m.write_end_open = write_end_open_;
  return m;
}

std::string PipeMetrics::to_json() const {
  std::ostringstream ss;
  ss << "{"
     << "\"capacity\":" << capacity << ","
     << "\"bytes_stored\":" << bytes_stored << ","
     << "\"total_written\":" << total_written << ","
     << "\"total_read\":" << total_read << ","
     << "\"write_operations\":" << write_operations << ","
     << "\"read_operations\":" << read_operations << ","
     << "\"broken_pipe_events\":" << broken_pipe_events << ","
     << "\"read_end_open\":" << (read_end_open ? "true" : "false") << ","
     << "\"write_end_open\":" << (write_end_open ? "true" : "false")
     << "}";
  return ss.str();
}

std::string Pipe::to_json() const {
  std::ostringstream ss;
  ss << "{"
     << "\"pipe_id\":" << id_ << ","
     << "\"metrics\":" << compute_metrics().to_json()
     << "}";
  return ss.str();
}

} // namespace kernellens
