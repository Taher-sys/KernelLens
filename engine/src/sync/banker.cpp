#include "kernellens/sync/banker.hpp"
#include <sstream>
#include <algorithm>

namespace kernellens {

BankersAlgorithm::BankersAlgorithm(std::size_t num_processes, std::size_t num_resources, EventLog* log)
    : num_processes_(num_processes), num_resources_(num_resources), log_(log),
      available_(num_resources, 0),
      max_(num_processes, std::vector<int>(num_resources, 0)),
      allocation_(num_processes, std::vector<int>(num_resources, 0)) {}

void BankersAlgorithm::set_available(std::vector<int> available) {
  available_ = std::move(available);
}

void BankersAlgorithm::set_maximum(std::size_t process_index, std::vector<int> max_claim) {
  if (process_index < num_processes_) {
    max_[process_index] = std::move(max_claim);
  }
}

void BankersAlgorithm::set_allocation(std::size_t process_index, std::vector<int> allocated) {
  if (process_index < num_processes_) {
    allocation_[process_index] = std::move(allocated);
  }
}

std::vector<std::vector<int>> BankersAlgorithm::need_matrix() const {
  std::vector<std::vector<int>> need(num_processes_, std::vector<int>(num_resources_, 0));
  for (std::size_t i = 0; i < num_processes_; ++i) {
    for (std::size_t j = 0; j < num_resources_; ++j) {
      need[i][j] = max_[i][j] - allocation_[i][j];
      if (need[i][j] < 0) need[i][j] = 0;
    }
  }
  return need;
}

BankerSafetyReport BankersAlgorithm::check_safety() const {
  BankerSafetyReport report;
  std::vector<int> work = available_;
  std::vector<bool> finish(num_processes_, false);
  auto need = need_matrix();

  std::size_t completed = 0;
  while (completed < num_processes_) {
    bool found = false;
    for (std::size_t i = 0; i < num_processes_; ++i) {
      if (!finish[i]) {
        bool can_satisfy = true;
        for (std::size_t j = 0; j < num_resources_; ++j) {
          if (need[i][j] > work[j]) {
            can_satisfy = false;
            break;
          }
        }

        if (can_satisfy) {
          // Process can complete and release allocated resources
          for (std::size_t j = 0; j < num_resources_; ++j) {
            work[j] += allocation_[i][j];
          }
          finish[i] = true;
          report.safe_sequence.push_back(static_cast<ProcessId>(i));
          completed++;
          found = true;
        }
      }
    }

    if (!found) {
      // Deadlock condition / Unsafe state
      break;
    }
  }

  report.is_safe = (completed == num_processes_);
  if (report.is_safe) {
    std::ostringstream ss;
    ss << "System is in a SAFE state. Safe execution sequence: <";
    for (std::size_t i = 0; i < report.safe_sequence.size(); ++i) {
      if (i > 0) ss << ", ";
      ss << "P" << report.safe_sequence[i];
    }
    ss << ">";
    report.explanation = ss.str();
  } else {
    report.explanation = "System is in an UNSAFE state. No safe execution sequence exists.";
  }

  return report;
}

BankerRequestResult BankersAlgorithm::request_resources(ProcessId pid, const std::vector<int>& request, Tick now) {
  BankerRequestResult result;
  std::size_t p_idx = static_cast<std::size_t>(pid);
  if (p_idx >= num_processes_) {
    result.granted = false;
    result.reason = "Invalid process ID";
    return result;
  }

  auto need = need_matrix();

  // Rule 1: Request <= Need
  for (std::size_t j = 0; j < num_resources_; ++j) {
    if (request[j] > need[p_idx][j]) {
      result.granted = false;
      result.reason = "Process has exceeded its maximum declared claim";
      if (log_) {
        log_->emit("sync", "banker_request_denied", pid, now, result.to_json());
      }
      return result;
    }
  }

  // Rule 2: Request <= Available
  for (std::size_t j = 0; j < num_resources_; ++j) {
    if (request[j] > available_[j]) {
      result.granted = false;
      result.reason = "Resources not available; process must wait";
      if (log_) {
        log_->emit("sync", "banker_request_denied", pid, now, result.to_json());
      }
      return result;
    }
  }

  // Speculative Allocation
  for (std::size_t j = 0; j < num_resources_; ++j) {
    available_[j] -= request[j];
    allocation_[p_idx][j] += request[j];
  }

  // Check safety of the resulting state
  BankerSafetyReport safety = check_safety();

  if (safety.is_safe) {
    result.granted = true;
    result.safe_sequence = safety.safe_sequence;
    result.reason = "Request granted safely. " + safety.explanation;

    if (log_) {
      log_->emit("sync", "banker_request_granted", pid, now, result.to_json());
    }
  } else {
    // Rollback speculative allocation
    for (std::size_t j = 0; j < num_resources_; ++j) {
      available_[j] += request[j];
      allocation_[p_idx][j] -= request[j];
    }
    result.granted = false;
    result.reason = "Request would result in an UNSAFE state. Process must wait.";

    if (log_) {
      log_->emit("sync", "banker_request_denied", pid, now, result.to_json());
    }
  }

  return result;
}

void BankersAlgorithm::reset() {
  for (auto& v : available_) v = 0;
  for (auto& row : max_) for (auto& v : row) v = 0;
  for (auto& row : allocation_) for (auto& v : row) v = 0;
}

std::string BankerSafetyReport::to_json() const {
  std::ostringstream ss;
  ss << "{"
     << "\"isSafe\":" << (is_safe ? "true" : "false")
     << ",\"safeSequence\":[";
  for (std::size_t i = 0; i < safe_sequence.size(); ++i) {
    if (i > 0) ss << ",";
    ss << safe_sequence[i];
  }
  ss << "],\"explanation\":\"" << explanation << "\"}";
  return ss.str();
}

std::string BankerRequestResult::to_json() const {
  std::ostringstream ss;
  ss << "{"
     << "\"granted\":" << (granted ? "true" : "false")
     << ",\"reason\":\"" << reason << "\""
     << ",\"safeSequence\":[";
  for (std::size_t i = 0; i < safe_sequence.size(); ++i) {
    if (i > 0) ss << ",";
    ss << safe_sequence[i];
  }
  ss << "]}";
  return ss.str();
}

} // namespace kernellens
