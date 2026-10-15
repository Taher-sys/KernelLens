#include "kernellens/core/comparator.hpp"
#include "kernellens/workload/presets.hpp"
#include "test_harness.hpp"
#include <cmath>

using namespace kernellens;

TEST_CASE(Comparator_Cpu_DeltasAndBadges) {
  auto workload = WorkloadPresets::convoy_effect();
  std::vector<std::string> policies = {"FCFS", "SJF", "ROUND_ROBIN"};

  auto report = ComparisonEngine::compare_cpu(workload, policies, "FCFS", 3, 0, 0);

  ASSERT_EQ(report.results.size(), 3);
  ASSERT_EQ(report.baseline_policy, "FCFS");

  // Verify baseline FCFS has zero deltas against itself
  for (const auto& r : report.results) {
    if (r.policy == "FCFS") {
      for (const auto& d : r.deltas) {
        ASSERT_NEAR(d.absolute_delta, 0.0, 1e-4);
      }
    } else if (r.policy == "ROUND_ROBIN") {
      // Round Robin should have lower waiting time than FCFS on convoy effect
      for (const auto& d : r.deltas) {
        if (d.metric_name == "waitingTime") {
          ASSERT_TRUE(d.absolute_delta < 0.0);
          ASSERT_TRUE(d.is_improvement);
        }
      }
    }
  }

  // Ensure JSON, table, and CSV formats produce valid non-empty content
  std::string json_str = report.to_json();
  ASSERT_TRUE(json_str.find("\"schemaVersion\":1") != std::string::npos);
  ASSERT_TRUE(json_str.find("\"baselinePolicy\":\"FCFS\"") != std::string::npos);

  std::string table_str = report.to_table();
  ASSERT_TRUE(table_str.find("KernelLens CPU Multi-Policy") != std::string::npos);

  std::string csv_str = report.to_csv();
  ASSERT_TRUE(csv_str.find("rank,policy,waiting_time") != std::string::npos);
}

TEST_CASE(Comparator_Disk_SeekDistancesAndRanking) {
  std::vector<std::uint32_t> requests = {98, 183, 37, 122, 14, 124, 65, 67};
  std::vector<std::string> policies = {"FCFS", "SSTF", "LOOK"};

  auto report = ComparisonEngine::compare_disk(requests, 53, HeadDirection::Up, 199, policies, "FCFS");

  ASSERT_EQ(report.results.size(), 3);

  // SSTF (236) < LOOK (299) < FCFS (640)
  for (const auto& r : report.results) {
    if (r.policy == "SSTF") {
      ASSERT_EQ(r.result.total_seek_distance, 236ULL);
      ASSERT_EQ(r.rank, 1);
      ASSERT_FALSE(r.badges.empty());
    } else if (r.policy == "FCFS") {
      ASSERT_EQ(r.result.total_seek_distance, 640ULL);
      ASSERT_EQ(r.rank, 3);
    }
  }

  std::string table = report.to_table();
  ASSERT_TRUE(table.find("236") != std::string::npos);
  ASSERT_TRUE(table.find("640") != std::string::npos);
}

TEST_CASE(Comparator_Memory_OptimalLowerBound) {
  std::vector<std::uint32_t> refs = {7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2, 1, 2, 0, 1, 7, 0, 1};
  std::vector<std::string> policies = {"FIFO", "LRU", "OPTIMAL"};

  auto report = ComparisonEngine::compare_memory(refs, 3, policies, "FIFO");

  ASSERT_EQ(report.results.size(), 3);

  std::size_t fifo_faults = 0, lru_faults = 0, opt_faults = 0;
  for (const auto& r : report.results) {
    if (r.policy == "FIFO") fifo_faults = r.metrics.page_faults;
    if (r.policy == "LRU") lru_faults = r.metrics.page_faults;
    if (r.policy == "OPTIMAL") opt_faults = r.metrics.page_faults;
  }

  // Textbook invariant: Optimal <= LRU <= FIFO (for standard string)
  ASSERT_TRUE(opt_faults <= lru_faults);
  ASSERT_TRUE(lru_faults <= fifo_faults);
}
