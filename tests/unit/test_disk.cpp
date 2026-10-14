#include "test_harness.hpp"
#include "kernellens/disk/schedulers.hpp"
#include "kernellens/workload/generator.hpp"

using namespace kernellens;
using namespace kernellens::testing;

TEST_CASE(Disk_DirectionAndBounds) {
  DiskScanScheduler scan;
  std::vector<std::uint32_t> reqs = {10, 50, 90};

  auto res_up = scan.schedule(50, HeadDirection::Up, 100, reqs);
  ASSERT_EQ(res_up.service_order.size(), 3);
  // Moving up: services 50, 90, reaches 100, then reverses to 10
  ASSERT_EQ(res_up.service_order[0], 50);
  ASSERT_EQ(res_up.service_order[1], 90);
  ASSERT_EQ(res_up.service_order[2], 10);
}

TEST_CASE(Workload_DeterministicSeed) {
  WorkloadGenerator gen1(WorkloadGeneratorConfig{12345, 5, 20, 2, 10, 0.0, 0, 0, 0, 5});
  WorkloadGenerator gen2(WorkloadGeneratorConfig{12345, 5, 20, 2, 10, 0.0, 0, 0, 0, 5});

  auto w1 = gen1.generate();
  auto w2 = gen2.generate();

  ASSERT_EQ(w1.size(), w2.size());
  for (std::size_t i = 0; i < w1.size(); ++i) {
    ASSERT_EQ(w1[i].pid, w2[i].pid);
    ASSERT_EQ(w1[i].arrival_time, w2[i].arrival_time);
    ASSERT_EQ(w1[i].bursts[0].duration, w2[i].bursts[0].duration);
    ASSERT_EQ(w1[i].base_priority, w2[i].base_priority);
  }
}
