#pragma once

#include "kernellens/core/types.hpp"
#include <vector>
#include <optional>
#include <string>

namespace kernellens {

struct ProcessMetrics {
  ProcessId pid = 0;
  Tick waiting_time = 0;
  Tick turnaround_time = 0;
  Tick response_time = 0;
  Tick cpu_service = 0;
};

struct AverageMetrics {
  double waiting_time = 0.0;
  double turnaround_time = 0.0;
  double response_time = 0.0;
};

struct SimulationMetrics {
  std::vector<ProcessMetrics> per_process;
  AverageMetrics averages;
  double throughput = 0.0;
  double cpu_utilization = 0.0;
  std::size_t context_switches = 0;
  std::optional<double> jain_fairness = std::nullopt;

  std::string to_json() const;
};

class MetricsCalculator {
public:
  static SimulationMetrics compute(const std::vector<ProcessRuntime>& processes,
                                   Tick total_elapsed_ticks,
                                   std::size_t context_switches,
                                   Tick switch_overhead_ticks = 0);
};

} // namespace kernellens
