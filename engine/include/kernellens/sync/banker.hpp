#pragma once

#include "kernellens/core/types.hpp"
#include "kernellens/core/event_log.hpp"
#include <vector>
#include <string>
#include <optional>

namespace kernellens {

struct BankerSafetyReport {
  bool is_safe = false;
  std::vector<ProcessId> safe_sequence;
  std::string explanation;
  std::string to_json() const;
};

struct BankerRequestResult {
  bool granted = false;
  std::string reason;
  std::vector<ProcessId> safe_sequence;
  std::string to_json() const;
};

class BankersAlgorithm {
public:
  BankersAlgorithm(std::size_t num_processes, std::size_t num_resources,
                   EventLog* log = nullptr);

  void set_available(std::vector<int> available);
  void set_maximum(std::size_t process_index, std::vector<int> max_claim);
  void set_allocation(std::size_t process_index, std::vector<int> allocated);

  BankerSafetyReport check_safety() const;
  BankerRequestResult request_resources(ProcessId pid, const std::vector<int>& request, Tick now = 0);

  const std::vector<int>& available() const noexcept { return available_; }
  const std::vector<std::vector<int>>& max_matrix() const noexcept { return max_; }
  const std::vector<std::vector<int>>& allocation_matrix() const noexcept { return allocation_; }
  std::vector<std::vector<int>> need_matrix() const;

  void reset();

private:
  std::size_t num_processes_;
  std::size_t num_resources_;
  EventLog* log_ = nullptr;

  std::vector<int> available_;
  std::vector<std::vector<int>> max_;
  std::vector<std::vector<int>> allocation_;
};

} // namespace kernellens
