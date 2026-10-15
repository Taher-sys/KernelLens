#pragma once

#include "kernellens/core/types.hpp"
#include <string>
#include <vector>
#include <optional>
#include <cstdint>

namespace kernellens {

struct SimulationRequest {
  std::string module = "cpu";
  std::string policy = "FCFS";
  std::string config = "{}";
  std::string run_id = "default";
  std::uint64_t seed = 42;
  Tick quantum = 3;
  std::vector<ProcessSpec> processes;
};

struct SimulationResult {
  std::string module = "cpu";
  std::string policy = "FCFS";
  std::string events = "[]";
  std::string metrics = "{}";
  int status_code = 0;
  std::string error_message;
};

class Simulation {
public:
  static SimulationResult run(const SimulationRequest& req);
};

} // namespace kernellens
