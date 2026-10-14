#pragma once

#include "kernellens/core/types.hpp"
#include "kernellens/core/event_log.hpp"
#include <cstdint>
#include <vector>
#include <string>

namespace kernellens {

enum class HeadDirection {
  Up,   // Increasing cylinder numbers (towards max)
  Down  // Decreasing cylinder numbers (towards 0)
};

inline std::string to_string(HeadDirection dir) {
  return dir == HeadDirection::Up ? "UP" : "DOWN";
}

struct DiskScheduleResult {
  std::vector<std::uint32_t> service_order;
  std::uint64_t total_seek_distance = 0;
  std::string to_json() const;
};

class IDiskScheduler {
public:
  virtual ~IDiskScheduler() = default;

  virtual std::string name() const = 0;
  virtual DiskScheduleResult schedule(std::uint32_t initial_head,
                                      HeadDirection direction,
                                      std::uint32_t max_cylinder,
                                      const std::vector<std::uint32_t>& requests,
                                      EventLog* log = nullptr) = 0;
};

} // namespace kernellens
