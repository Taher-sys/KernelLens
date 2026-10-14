#include "kernellens/disk/schedulers.hpp"
#include <algorithm>
#include <cmath>
#include <sstream>

namespace kernellens {

static void emit_disk_step(EventLog* log, Tick step, std::uint32_t from, std::uint32_t to,
                           std::uint64_t accumulated_seek, const std::string& policy) {
  if (!log) return;
  std::ostringstream ss;
  ss << "{\"fromCylinder\":" << from
     << ",\"toCylinder\":" << to
     << ",\"distance\":" << std::abs(static_cast<long long>(to) - static_cast<long long>(from))
     << ",\"accumulatedSeek\":" << accumulated_seek
     << ",\"policy\":\"" << policy << "\"}";
  log->emit("disk", "disk_request_serviced", std::nullopt, step, ss.str());
}

std::string DiskScheduleResult::to_json() const {
  std::ostringstream ss;
  ss << "{"
     << "\"totalSeekDistance\":" << total_seek_distance
     << ",\"serviceOrder\":[";
  for (std::size_t i = 0; i < service_order.size(); ++i) {
    if (i > 0) ss << ",";
    ss << service_order[i];
  }
  ss << "]}";
  return ss.str();
}

// -------------------------------------------------------------
// FCFS
// -------------------------------------------------------------
DiskScheduleResult DiskFcfsScheduler::schedule(std::uint32_t initial_head, HeadDirection direction,
                                               std::uint32_t max_cylinder,
                                               const std::vector<std::uint32_t>& requests,
                                               EventLog* log) {
  (void)direction;
  (void)max_cylinder;
  DiskScheduleResult result;
  std::uint32_t current = initial_head;
  Tick tick = 0;

  for (std::uint32_t req : requests) {
    result.total_seek_distance += std::abs(static_cast<long long>(req) - static_cast<long long>(current));
    result.service_order.push_back(req);
    emit_disk_step(log, ++tick, current, req, result.total_seek_distance, "FCFS");
    current = req;
  }
  return result;
}

// -------------------------------------------------------------
// SSTF
// -------------------------------------------------------------
DiskScheduleResult DiskSstfScheduler::schedule(std::uint32_t initial_head, HeadDirection direction,
                                               std::uint32_t max_cylinder,
                                               const std::vector<std::uint32_t>& requests,
                                               EventLog* log) {
  (void)direction;
  (void)max_cylinder;
  DiskScheduleResult result;
  std::vector<std::uint32_t> pending = requests;
  std::uint32_t current = initial_head;
  Tick tick = 0;

  while (!pending.empty()) {
    auto best_it = pending.begin();
    std::uint64_t min_dist = std::abs(static_cast<long long>(*best_it) - static_cast<long long>(current));

    for (auto it = pending.begin() + 1; it != pending.end(); ++it) {
      std::uint64_t dist = std::abs(static_cast<long long>(*it) - static_cast<long long>(current));
      if (dist < min_dist || (dist == min_dist && *it < *best_it)) {
        min_dist = dist;
        best_it = it;
      }
    }

    std::uint32_t selected = *best_it;
    pending.erase(best_it);

    result.total_seek_distance += min_dist;
    result.service_order.push_back(selected);
    emit_disk_step(log, ++tick, current, selected, result.total_seek_distance, "SSTF");
    current = selected;
  }

  return result;
}

// -------------------------------------------------------------
// SCAN (Elevator)
// -------------------------------------------------------------
DiskScheduleResult DiskScanScheduler::schedule(std::uint32_t initial_head, HeadDirection direction,
                                               std::uint32_t max_cylinder,
                                               const std::vector<std::uint32_t>& requests,
                                               EventLog* log) {
  DiskScheduleResult result;
  if (requests.empty()) return result;

  std::vector<std::uint32_t> upper, lower;
  for (std::uint32_t r : requests) {
    if (r >= initial_head) upper.push_back(r);
    else lower.push_back(r);
  }

  std::sort(upper.begin(), upper.end());
  std::sort(lower.begin(), lower.end());

  std::uint32_t current = initial_head;
  Tick tick = 0;

  if (direction == HeadDirection::Up) {
    for (std::uint32_t req : upper) {
      result.total_seek_distance += std::abs(static_cast<long long>(req) - static_cast<long long>(current));
      result.service_order.push_back(req);
      emit_disk_step(log, ++tick, current, req, result.total_seek_distance, "SCAN");
      current = req;
    }
    if (!lower.empty()) {
      // Must visit boundary max_cylinder
      result.total_seek_distance += std::abs(static_cast<long long>(max_cylinder) - static_cast<long long>(current));
      current = max_cylinder;
      for (auto it = lower.rbegin(); it != lower.rend(); ++it) {
        result.total_seek_distance += std::abs(static_cast<long long>(*it) - static_cast<long long>(current));
        result.service_order.push_back(*it);
        emit_disk_step(log, ++tick, current, *it, result.total_seek_distance, "SCAN");
        current = *it;
      }
    }
  } else {
    for (auto it = lower.rbegin(); it != lower.rend(); ++it) {
      result.total_seek_distance += std::abs(static_cast<long long>(*it) - static_cast<long long>(current));
      result.service_order.push_back(*it);
      emit_disk_step(log, ++tick, current, *it, result.total_seek_distance, "SCAN");
      current = *it;
    }
    if (!upper.empty()) {
      // Must visit boundary 0
      result.total_seek_distance += current;
      current = 0;
      for (std::uint32_t req : upper) {
        result.total_seek_distance += std::abs(static_cast<long long>(req) - static_cast<long long>(current));
        result.service_order.push_back(req);
        emit_disk_step(log, ++tick, current, req, result.total_seek_distance, "SCAN");
        current = req;
      }
    }
  }

  return result;
}

// -------------------------------------------------------------
// C-SCAN (Circular SCAN)
// -------------------------------------------------------------
DiskScheduleResult DiskCScanScheduler::schedule(std::uint32_t initial_head, HeadDirection direction,
                                                 std::uint32_t max_cylinder,
                                                 const std::vector<std::uint32_t>& requests,
                                                 EventLog* log) {
  DiskScheduleResult result;
  if (requests.empty()) return result;

  std::vector<std::uint32_t> upper, lower;
  for (std::uint32_t r : requests) {
    if (r >= initial_head) upper.push_back(r);
    else lower.push_back(r);
  }

  std::sort(upper.begin(), upper.end());
  std::sort(lower.begin(), lower.end());

  std::uint32_t current = initial_head;
  Tick tick = 0;

  if (direction == HeadDirection::Up) {
    for (std::uint32_t req : upper) {
      result.total_seek_distance += std::abs(static_cast<long long>(req) - static_cast<long long>(current));
      result.service_order.push_back(req);
      emit_disk_step(log, ++tick, current, req, result.total_seek_distance, "C-SCAN");
      current = req;
    }
    if (!lower.empty()) {
      // Reach max_cylinder
      result.total_seek_distance += std::abs(static_cast<long long>(max_cylinder) - static_cast<long long>(current));
      // Jump to 0 (seek counted)
      result.total_seek_distance += max_cylinder;
      current = 0;

      for (std::uint32_t req : lower) {
        result.total_seek_distance += std::abs(static_cast<long long>(req) - static_cast<long long>(current));
        result.service_order.push_back(req);
        emit_disk_step(log, ++tick, current, req, result.total_seek_distance, "C-SCAN");
        current = req;
      }
    }
  } else {
    for (auto it = lower.rbegin(); it != lower.rend(); ++it) {
      result.total_seek_distance += std::abs(static_cast<long long>(*it) - static_cast<long long>(current));
      result.service_order.push_back(*it);
      emit_disk_step(log, ++tick, current, *it, result.total_seek_distance, "C-SCAN");
      current = *it;
    }
    if (!upper.empty()) {
      result.total_seek_distance += current;
      result.total_seek_distance += max_cylinder;
      current = max_cylinder;

      for (auto it = upper.rbegin(); it != upper.rend(); ++it) {
        result.total_seek_distance += std::abs(static_cast<long long>(*it) - static_cast<long long>(current));
        result.service_order.push_back(*it);
        emit_disk_step(log, ++tick, current, *it, result.total_seek_distance, "C-SCAN");
        current = *it;
      }
    }
  }

  return result;
}

// -------------------------------------------------------------
// LOOK
// -------------------------------------------------------------
DiskScheduleResult DiskLookScheduler::schedule(std::uint32_t initial_head, HeadDirection direction,
                                               std::uint32_t max_cylinder,
                                               const std::vector<std::uint32_t>& requests,
                                               EventLog* log) {
  (void)max_cylinder;
  DiskScheduleResult result;
  if (requests.empty()) return result;

  std::vector<std::uint32_t> upper, lower;
  for (std::uint32_t r : requests) {
    if (r >= initial_head) upper.push_back(r);
    else lower.push_back(r);
  }

  std::sort(upper.begin(), upper.end());
  std::sort(lower.begin(), lower.end());

  std::uint32_t current = initial_head;
  Tick tick = 0;

  if (direction == HeadDirection::Up) {
    for (std::uint32_t req : upper) {
      result.total_seek_distance += std::abs(static_cast<long long>(req) - static_cast<long long>(current));
      result.service_order.push_back(req);
      emit_disk_step(log, ++tick, current, req, result.total_seek_distance, "LOOK");
      current = req;
    }
    for (auto it = lower.rbegin(); it != lower.rend(); ++it) {
      result.total_seek_distance += std::abs(static_cast<long long>(*it) - static_cast<long long>(current));
      result.service_order.push_back(*it);
      emit_disk_step(log, ++tick, current, *it, result.total_seek_distance, "LOOK");
      current = *it;
    }
  } else {
    for (auto it = lower.rbegin(); it != lower.rend(); ++it) {
      result.total_seek_distance += std::abs(static_cast<long long>(*it) - static_cast<long long>(current));
      result.service_order.push_back(*it);
      emit_disk_step(log, ++tick, current, *it, result.total_seek_distance, "LOOK");
      current = *it;
    }
    for (std::uint32_t req : upper) {
      result.total_seek_distance += std::abs(static_cast<long long>(req) - static_cast<long long>(current));
      result.service_order.push_back(req);
      emit_disk_step(log, ++tick, current, req, result.total_seek_distance, "LOOK");
      current = req;
    }
  }

  return result;
}

// -------------------------------------------------------------
// C-LOOK
// -------------------------------------------------------------
DiskScheduleResult DiskCLookScheduler::schedule(std::uint32_t initial_head, HeadDirection direction,
                                                 std::uint32_t max_cylinder,
                                                 const std::vector<std::uint32_t>& requests,
                                                 EventLog* log) {
  (void)max_cylinder;
  DiskScheduleResult result;
  if (requests.empty()) return result;

  std::vector<std::uint32_t> upper, lower;
  for (std::uint32_t r : requests) {
    if (r >= initial_head) upper.push_back(r);
    else lower.push_back(r);
  }

  std::sort(upper.begin(), upper.end());
  std::sort(lower.begin(), lower.end());

  std::uint32_t current = initial_head;
  Tick tick = 0;

  if (direction == HeadDirection::Up) {
    for (std::uint32_t req : upper) {
      result.total_seek_distance += std::abs(static_cast<long long>(req) - static_cast<long long>(current));
      result.service_order.push_back(req);
      emit_disk_step(log, ++tick, current, req, result.total_seek_distance, "C-LOOK");
      current = req;
    }
    for (std::uint32_t req : lower) {
      result.total_seek_distance += std::abs(static_cast<long long>(req) - static_cast<long long>(current));
      result.service_order.push_back(req);
      emit_disk_step(log, ++tick, current, req, result.total_seek_distance, "C-LOOK");
      current = req;
    }
  } else {
    for (auto it = lower.rbegin(); it != lower.rend(); ++it) {
      result.total_seek_distance += std::abs(static_cast<long long>(*it) - static_cast<long long>(current));
      result.service_order.push_back(*it);
      emit_disk_step(log, ++tick, current, *it, result.total_seek_distance, "C-LOOK");
      current = *it;
    }
    for (auto it = upper.rbegin(); it != upper.rend(); ++it) {
      result.total_seek_distance += std::abs(static_cast<long long>(*it) - static_cast<long long>(current));
      result.service_order.push_back(*it);
      emit_disk_step(log, ++tick, current, *it, result.total_seek_distance, "C-LOOK");
      current = *it;
    }
  }

  return result;
}

} // namespace kernellens
