#pragma once

#include <cstdint>
#include <string>
#include <vector>
#include <optional>
#include <iostream>

namespace kernellens {

using Tick = std::int64_t;
using ProcessId = std::uint32_t;
using SequenceNo = std::uint64_t;

enum class ProcessState {
  New,
  Ready,
  Running,
  Waiting,
  Terminated
};

inline std::string to_string(ProcessState state) {
  switch (state) {
    case ProcessState::New: return "NEW";
    case ProcessState::Ready: return "READY";
    case ProcessState::Running: return "RUNNING";
    case ProcessState::Waiting: return "WAITING";
    case ProcessState::Terminated: return "TERMINATED";
  }
  return "UNKNOWN";
}

enum class BurstKind {
  Cpu,
  Io
};

inline std::string to_string(BurstKind kind) {
  switch (kind) {
    case BurstKind::Cpu: return "CPU";
    case BurstKind::Io: return "IO";
  }
  return "UNKNOWN";
}

struct BurstSegment {
  BurstKind kind = BurstKind::Cpu;
  Tick duration = 0;
};

struct ProcessSpec {
  ProcessId pid = 0;
  Tick arrival_time = 0;
  std::vector<BurstSegment> bursts;
  int base_priority = 0; // Lower integer = higher priority
  int nice_value = 0;    // Standard -20 to 19 for CFS-like scheduler
};

struct ProcessRuntime {
  ProcessSpec spec;
  ProcessState state = ProcessState::New;
  std::size_t burst_index = 0;
  Tick remaining_current_burst = 0;
  Tick first_run_time = -1;
  Tick finish_time = -1;
  Tick cpu_service = 0;
  Tick ready_wait = 0;
  Tick last_ready_time = -1;
  int current_priority = 0;
  double vruntime = 0.0;
  int mlfq_level = 0;
  Tick mlfq_time_in_level = 0;

  bool is_completed() const {
    return state == ProcessState::Terminated;
  }
};

} // namespace kernellens
