#include "kernellens/core/comparator.hpp"
#include "kernellens/workload/presets.hpp"
#include "test_harness.hpp"
#include <cmath>

using namespace kernellens;

TEST_CASE(Golden_Comparison_SilberschatzConvoy_FCFS_vs_RR) {
  // Classic Silberschatz textbook convoy effect:
  // P1: burst 24, P2: burst 3, P3: burst 3, all arriving at tick 0.
  // FCFS:
  // P1 wait = 0, P2 wait = 24, P3 wait = 27. Avg wait = (0 + 24 + 27) / 3 = 17.0 ticks.
  // Round Robin (q=3):
  // P1 gets [0,3), P2 gets [3,6) finishes (wait = 3), P3 gets [6,9) finishes (wait = 6),
  // P1 gets remaining 21 bursts [9,30) finishes (wait = 6).
  // RR Avg wait = (6 + 3 + 6) / 3 = 17 / 3 = 5.6667 ticks.
  // Delta wait = 5.6667 - 17.0 = -11.3333 ticks. Percent change = -66.67%.

  auto workload = WorkloadPresets::convoy_effect();
  auto report = ComparisonEngine::compare_cpu(workload, {"FCFS", "ROUND_ROBIN"}, "FCFS", 3, 0, 0);

  ASSERT_EQ(report.results.size(), 2);

  const CpuPolicyComparison* fcfs = nullptr;
  const CpuPolicyComparison* rr = nullptr;

  for (const auto& r : report.results) {
    if (r.policy == "FCFS") fcfs = &r;
    if (r.policy == "ROUND_ROBIN") rr = &r;
  }

  ASSERT_TRUE(fcfs != nullptr);
  ASSERT_TRUE(rr != nullptr);

  ASSERT_NEAR(fcfs->metrics.averages.waiting_time, 17.0, 0.05);
  ASSERT_NEAR(rr->metrics.averages.waiting_time, 5.0, 0.05);

  bool found_wait_delta = false;
  for (const auto& d : rr->deltas) {
    if (d.metric_name == "waitingTime") {
      found_wait_delta = true;
      ASSERT_NEAR(d.absolute_delta, -12.0, 0.05);
      ASSERT_NEAR(d.percent_change, -70.59, 0.1);
      ASSERT_TRUE(d.is_improvement);
    }
  }
  ASSERT_TRUE(found_wait_delta);
}

TEST_CASE(Golden_Comparison_Disk_Textbook_FCFS_vs_SSTF) {
  // Textbook 8-request queue [98, 183, 37, 122, 14, 124, 65, 67], initial head = 53
  // FCFS seek distance: 640 cylinders
  // SSTF seek distance: 236 cylinders
  // Delta seek distance: 236 - 640 = -404 cylinders (-63.125%)

  std::vector<std::uint32_t> reqs = {98, 183, 37, 122, 14, 124, 65, 67};
  auto report = ComparisonEngine::compare_disk(reqs, 53, HeadDirection::Up, 199, {"FCFS", "SSTF"}, "FCFS");

  const DiskPolicyComparison* sstf = nullptr;
  for (const auto& r : report.results) {
    if (r.policy == "SSTF") sstf = &r;
  }

  ASSERT_TRUE(sstf != nullptr);
  ASSERT_EQ(sstf->result.total_seek_distance, 236ULL);

  bool found_seek_delta = false;
  for (const auto& d : sstf->deltas) {
    if (d.metric_name == "seekDistance") {
      found_seek_delta = true;
      ASSERT_NEAR(d.absolute_delta, -404.0, 1e-4);
      ASSERT_NEAR(d.percent_change, -63.125, 0.01);
      ASSERT_TRUE(d.is_improvement);
    }
  }
  ASSERT_TRUE(found_seek_delta);
}
