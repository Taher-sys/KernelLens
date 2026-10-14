#pragma once

#include "kernellens/core/types.hpp"
#include <vector>
#include <string>

namespace kernellens {

class WorkloadPresets {
public:
  static std::vector<ProcessSpec> convoy_effect();
  static std::vector<ProcessSpec> sjf_benchmark();
  static std::vector<ProcessSpec> starvation_scenario();
  static std::vector<ProcessSpec> interactive_mixed();
  static std::vector<ProcessSpec> round_robin_demo();
  static std::vector<ProcessSpec> mlfq_demo();
};

} // namespace kernellens
