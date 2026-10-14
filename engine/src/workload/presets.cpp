#include "kernellens/workload/presets.hpp"

namespace kernellens {

std::vector<ProcessSpec> WorkloadPresets::convoy_effect() {
  // Classic Silberschatz textbook convoy effect:
  // P1 requires 24 ticks, P2 requires 3, P3 requires 3.
  // All arrive at time 0.
  return {
    {1, 0, {{BurstKind::Cpu, 24}}, 0, 0},
    {2, 0, {{BurstKind::Cpu, 3}},  0, 0},
    {3, 0, {{BurstKind::Cpu, 3}},  0, 0}
  };
}

std::vector<ProcessSpec> WorkloadPresets::sjf_benchmark() {
  // P1 arrival 0 burst 6
  // P2 arrival 1 burst 4
  // P3 arrival 2 burst 8
  // P4 arrival 3 burst 3
  return {
    {1, 0, {{BurstKind::Cpu, 6}}, 0, 0},
    {2, 1, {{BurstKind::Cpu, 4}}, 0, 0},
    {3, 2, {{BurstKind::Cpu, 8}}, 0, 0},
    {4, 3, {{BurstKind::Cpu, 3}}, 0, 0}
  };
}

std::vector<ProcessSpec> WorkloadPresets::starvation_scenario() {
  // P1 has low priority (value 10) with burst 20 arriving at 0.
  // P2..P5 have high priority (value 1) arriving successively, starving P1 without aging.
  return {
    {1, 0,  {{BurstKind::Cpu, 20}}, 10, 0},
    {2, 1,  {{BurstKind::Cpu, 4}},  1,  0},
    {3, 5,  {{BurstKind::Cpu, 4}},  1,  0},
    {4, 9,  {{BurstKind::Cpu, 4}},  1,  0},
    {5, 13, {{BurstKind::Cpu, 4}},  1,  0}
  };
}

std::vector<ProcessSpec> WorkloadPresets::interactive_mixed() {
  // Processes alternating between CPU and I/O bursts
  return {
    {1, 0, {{BurstKind::Cpu, 4}, {BurstKind::Io, 3}, {BurstKind::Cpu, 4}}, 1, 0},
    {2, 2, {{BurstKind::Cpu, 3}, {BurstKind::Io, 5}, {BurstKind::Cpu, 2}}, 2, 0},
    {3, 4, {{BurstKind::Cpu, 6}, {BurstKind::Io, 2}, {BurstKind::Cpu, 1}}, 3, 0}
  };
}

std::vector<ProcessSpec> WorkloadPresets::round_robin_demo() {
  // Standard 4-process round robin benchmark
  return {
    {1, 0, {{BurstKind::Cpu, 5}}, 0, 0},
    {2, 1, {{BurstKind::Cpu, 3}}, 0, 0},
    {3, 2, {{BurstKind::Cpu, 8}}, 0, 0},
    {4, 3, {{BurstKind::Cpu, 6}}, 0, 0}
  };
}

std::vector<ProcessSpec> WorkloadPresets::mlfq_demo() {
  // A CPU-bound task (P1) and an I/O interactive task (P2)
  return {
    {1, 0, {{BurstKind::Cpu, 20}}, 0, 0},
    {2, 0, {{BurstKind::Cpu, 2}, {BurstKind::Io, 2}, {BurstKind::Cpu, 2}, {BurstKind::Io, 2}, {BurstKind::Cpu, 2}}, 0, 0}
  };
}

} // namespace kernellens
