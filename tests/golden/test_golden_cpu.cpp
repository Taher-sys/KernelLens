#include "test_harness.hpp"
#include "kernellens/core/engine.hpp"
#include "kernellens/cpu/fcfs.hpp"
#include "kernellens/cpu/round_robin.hpp"
#include "kernellens/cpu/sjf.hpp"
#include "kernellens/workload/presets.hpp"

using namespace kernellens;
using namespace kernellens::testing;

TEST_CASE(Golden_ConvoyEffect_FCFS) {
  // P1 (24), P2 (3), P3 (3) at t=0
  auto workload = WorkloadPresets::convoy_effect();

  SimulationConfig config;
  config.run_id = "golden-convoy-fcfs";
  SimulationEngine engine(config);
  engine.set_scheduler(std::make_unique<FcfsScheduler>());
  engine.load_workload(workload);

  engine.run();

  const auto& metrics = engine.metrics();

  // Total duration: 30 ticks
  ASSERT_EQ(engine.current_tick(), 30);

  // Per-process waiting times
  ASSERT_EQ(metrics.per_process[0].waiting_time, 0);   // P1
  ASSERT_EQ(metrics.per_process[1].waiting_time, 24);  // P2
  ASSERT_EQ(metrics.per_process[2].waiting_time, 27);  // P3

  // Average waiting time: (0 + 24 + 27) / 3 = 17.0
  ASSERT_NEAR(metrics.averages.waiting_time, 17.0, 0.001);

  // Average turnaround: (24 + 27 + 30) / 3 = 27.0
  ASSERT_NEAR(metrics.averages.turnaround_time, 27.0, 0.001);
}

TEST_CASE(Golden_ConvoyEffect_RoundRobin) {
  // Same workload: P1 (24), P2 (3), P3 (3) at t=0, with quantum=3
  auto workload = WorkloadPresets::convoy_effect();

  SimulationConfig config;
  config.run_id = "golden-convoy-rr";
  SimulationEngine engine(config);
  engine.set_scheduler(std::make_unique<RoundRobinScheduler>(3));
  engine.load_workload(workload);

  engine.run();

  const auto& metrics = engine.metrics();

  // Total duration: 30 ticks
  ASSERT_EQ(engine.current_tick(), 30);

  // P2 finishes at t=6 (turnaround = 6, wait = 3)
  ASSERT_EQ(metrics.per_process[1].turnaround_time, 6);
  ASSERT_EQ(metrics.per_process[1].waiting_time, 3);

  // P3 finishes at t=9 (turnaround = 9, wait = 6)
  ASSERT_EQ(metrics.per_process[2].turnaround_time, 9);
  ASSERT_EQ(metrics.per_process[2].waiting_time, 6);

  // P1 finishes at t=30 (turnaround = 30, wait = 6)
  ASSERT_EQ(metrics.per_process[0].turnaround_time, 30);
  ASSERT_EQ(metrics.per_process[0].waiting_time, 6);

  // Average waiting time: (6 + 3 + 6) / 3 = 5.0
  ASSERT_NEAR(metrics.averages.waiting_time, 5.0, 0.001);

  // Assert Round Robin dramatically outperformed FCFS on the convoy workload (5.0 vs 17.0 wait)
  ASSERT_TRUE(metrics.averages.waiting_time < 17.0);
}
