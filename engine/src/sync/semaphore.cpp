#include "kernellens/sync/semaphore.hpp"
#include <sstream>
#include <stdexcept>

namespace kernellens {

SimSemaphore::SimSemaphore(std::string id, int initial_value, EventLog* log)
    : id_(std::move(id)), initial_value_(initial_value), value_(initial_value), log_(log) {}

bool SimSemaphore::wait(ProcessId pid, Tick now) {
  int before = value_;
  value_--;
  bool blocked = (value_ < 0);

  if (blocked) {
    wait_queue_.push_back(pid);
  }

  if (log_) {
    std::ostringstream ss;
    ss << "{\"semId\":\"" << id_ << "\""
       << ",\"valueBefore\":" << before
       << ",\"valueAfter\":" << value_
       << ",\"blocked\":" << (blocked ? "true" : "false") << "}";
    log_->emit("sync", "semaphore_wait", pid, now, ss.str());
  }

  return !blocked; // Returns true if acquired immediately without blocking
}

std::optional<ProcessId> SimSemaphore::signal(Tick now) {
  int before = value_;
  value_++;
  std::optional<ProcessId> unblocked = std::nullopt;

  if (value_ <= 0 && !wait_queue_.empty()) {
    unblocked = wait_queue_.front();
    wait_queue_.pop_front();
  }

  if (log_) {
    std::ostringstream ss;
    ss << "{\"semId\":\"" << id_ << "\""
       << ",\"valueBefore\":" << before
       << ",\"valueAfter\":" << value_;
    if (unblocked.has_value()) {
      ss << ",\"unblockedPid\":" << *unblocked;
    }
    ss << "}";
    log_->emit("sync", "semaphore_signal", unblocked, now, ss.str());
  }

  return unblocked;
}

void SimSemaphore::reset(int initial_value) {
  initial_value_ = initial_value;
  value_ = initial_value;
  wait_queue_.clear();
}

// -------------------------------------------------------------
// SimMutex
// -------------------------------------------------------------
SimMutex::SimMutex(std::string id, EventLog* log)
    : sem_(std::move(id), 1, log), log_(log) {}

bool SimMutex::lock(ProcessId pid, Tick now) {
  bool acquired = sem_.wait(pid, now);
  if (acquired) {
    owner_ = pid;
  }
  return acquired;
}

std::optional<ProcessId> SimMutex::unlock(ProcessId pid, Tick now) {
  if (owner_.has_value() && *owner_ != pid) {
    throw std::runtime_error("Process " + std::to_string(pid) + " cannot release mutex owned by " + std::to_string(*owner_));
  }
  owner_ = std::nullopt;
  auto unblocked = sem_.signal(now);
  if (unblocked.has_value()) {
    owner_ = *unblocked;
  }
  return unblocked;
}

void SimMutex::reset() {
  sem_.reset(1);
  owner_ = std::nullopt;
}

} // namespace kernellens
