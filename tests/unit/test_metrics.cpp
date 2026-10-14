#include "test_harness.hpp"
#include "kernellens/core/metrics.hpp"

using namespace kernellens;
using namespace kernellens::testing;

TEST_CASE(Metrics_TurnaroundAndWaiting) {
  std::vector<ProcessRuntime> procs;

  // P1: arrives 0, first run 0, finishes 10, wait 0, cpu 10
  ProcessRuntime p1;
  p1.spec.pid = 1;
  p1.spec.arrival_time = 0;
  p1.first_run_time = 0;
  p1.finish_time = 10;
  p1.ready_wait = 0;
  p1.cpu_service = 10;

  // P2: arrives 0, first run 10, finishes 14, wait 10, cpu 4
  ProcessRuntime p2;
  p2.spec.pid = 2;
  p2.spec.arrival_time = 0;
  p2.first_run_time = 10;
  p2.finish_time = 14;
  p2.ready_wait = 10;
  p2.cpu_service = 4;

  procs = {p1, p2};

  SimulationMetrics metrics = MetricsCalculator::compute(procs, 14, 2);

  // Turnaround: P1 = 10 - 0 = 10; P2 = 14 - 0 = 14. Avg = (10 + 14) / 2 = 12.0
  ASSERT_NEAR(metrics.averages.turnaround_time, 12.0, 0.001);

  // Waiting: P1 = 0; P2 = 10. Avg = (0 + 10) / 2 = 5.0
  ASSERT_NEAR(metrics.averages.waiting_time, 5.0, 0.001);

  // Response: P1 = 0; P2 = 10. Avg = 5.0
  ASSERT_NEAR(metrics.averages.response_time, 5.0, 0.001);

  // Useful CPU Utilization: (10 + 4) / 14 = 1.0 (100%)
  ASSERT_NEAR(metrics.cpu_utilization, 1.0, 0.001);

  // Context switches
  ASSERT_EQ(metrics.context_switches, 2);
}

TEST_CASE(Metrics_JainFairnessIndex) {
  std::vector<ProcessRuntime> procs;

  // Equal CPU distribution -> Jain index should be exactly 1.0
  ProcessRuntime p1; p1.spec.pid = 1; p1.cpu_service = 10;
  ProcessRuntime p2; p2.spec.pid = 2; p2.cpu_service = 10;
  procs = {p1, p2};

  SimulationMetrics metrics = MetricsCalculator::compute(procs, 20, 1);
  ASSERT_TRUE(metrics.jain_fairness.has_value());
  ASSERT_NEAR(*metrics.jain_fairness, 1.0, 0.001);

  // Skewed CPU distribution: P1 gets 10, P2 gets 0
  p2.cpu_service = 0;
  procs = {p1, p2};
  metrics = MetricsCalculator::compute(procs, 10, 1);
  ASSERT_TRUE(metrics.jain_fairness.has_value());
  // (10)^2 / (2 * 100) = 0.5
  ASSERT_NEAR(*metrics.jain_fairness, 0.5, 0.001);
}
