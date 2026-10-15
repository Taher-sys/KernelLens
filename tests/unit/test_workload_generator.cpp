#include "kernellens/workload/generator.hpp"
#include "test_harness.hpp"
#include <algorithm>

using namespace kernellens;

TEST_CASE(Workload_DeterministicSeed_Consistency) {
  WorkloadGeneratorConfig cfg1;
  cfg1.seed = 987654321ULL;
  cfg1.num_processes = 6;
  cfg1.min_burst = 3;
  cfg1.max_burst = 18;

  WorkloadGenerator gen1(cfg1);
  auto w1 = gen1.generate();

  WorkloadGenerator gen2(cfg1);
  auto w2 = gen2.generate();

  ASSERT_EQ(w1.size(), 6);
  ASSERT_EQ(w2.size(), 6);

  for (std::size_t i = 0; i < w1.size(); ++i) {
    ASSERT_EQ(w1[i].pid, w2[i].pid);
    ASSERT_EQ(w1[i].arrival_time, w2[i].arrival_time);
    ASSERT_EQ(w1[i].base_priority, w2[i].base_priority);
    ASSERT_EQ(w1[i].nice_value, w2[i].nice_value);
    ASSERT_EQ(w1[i].bursts.size(), w2[i].bursts.size());
    for (std::size_t b = 0; b < w1[i].bursts.size(); ++b) {
      ASSERT_EQ(static_cast<int>(w1[i].bursts[b].kind), static_cast<int>(w2[i].bursts[b].kind));
      ASSERT_EQ(w1[i].bursts[b].duration, w2[i].bursts[b].duration);
    }
  }

  // Different seed should yield different workload
  WorkloadGeneratorConfig cfg3 = cfg1;
  cfg3.seed = 11223344ULL;
  WorkloadGenerator gen3(cfg3);
  auto w3 = gen3.generate();

  bool found_difference = false;
  for (std::size_t i = 0; i < w1.size(); ++i) {
    if (w1[i].arrival_time != w3[i].arrival_time ||
        w1[i].bursts[0].duration != w3[i].bursts[0].duration) {
      found_difference = true;
      break;
    }
  }
  ASSERT_TRUE(found_difference);
}

TEST_CASE(Workload_Distributions_Validity) {
  for (auto dist : {DistributionType::Uniform, DistributionType::Exponential, DistributionType::Bimodal, DistributionType::Normal}) {
    WorkloadGeneratorConfig cfg;
    cfg.seed = 42;
    cfg.num_processes = 20;
    cfg.min_burst = 2;
    cfg.max_burst = 20;
    cfg.burst_distribution = dist;

    WorkloadGenerator gen(cfg);
    auto workload = gen.generate();

    ASSERT_EQ(workload.size(), 20);
    for (const auto& sp : workload) {
      ASSERT_TRUE(sp.pid >= 1);
      ASSERT_TRUE(sp.arrival_time >= 0);
      ASSERT_FALSE(sp.bursts.empty());
      for (const auto& b : sp.bursts) {
        ASSERT_TRUE(b.duration >= 1);
      }
    }
  }
}

TEST_CASE(Workload_DiskAndMemoryPatterns) {
  WorkloadGenerator gen(WorkloadGeneratorConfig{42, 5, 20, 2, 25, 0.3, 2, 10, 0, 10, DistributionType::Uniform});

  // Clustered disk requests
  auto disk_reqs = gen.generate_disk_requests(100, 199, DiskPatternType::Clustered);
  ASSERT_EQ(disk_reqs.size(), 100);
  for (auto r : disk_reqs) {
    ASSERT_TRUE(r <= 199);
  }

  // Sequential disk requests
  auto seq_disk = gen.generate_disk_requests(50, 199, DiskPatternType::Sequential);
  ASSERT_EQ(seq_disk.size(), 50);

  // Locality 80/20 memory reference string
  auto refs = gen.generate_page_reference_string(200, 10, MemoryPatternType::Locality8020);
  ASSERT_EQ(refs.size(), 200);
  for (auto p : refs) {
    ASSERT_TRUE(p < 10);
  }

  // Looping reference string
  auto loop_refs = gen.generate_page_reference_string(30, 5, MemoryPatternType::Looping);
  ASSERT_EQ(loop_refs.size(), 30);
  for (std::size_t i = 0; i < loop_refs.size(); ++i) {
    ASSERT_EQ(loop_refs[i], static_cast<std::uint32_t>(i % 5));
  }
}

TEST_CASE(Workload_JsonSerialization_RoundTrip) {
  std::vector<ProcessSpec> original = {
    {1, 0, {{BurstKind::Cpu, 15}, {BurstKind::Io, 5}, {BurstKind::Cpu, 10}}, 2, -5},
    {2, 3, {{BurstKind::Cpu, 8}}, 0, 0},
    {3, 6, {{BurstKind::Cpu, 4}, {BurstKind::Io, 2}}, 5, 10}
  };

  std::string json_str = WorkloadGenerator::to_json(original, "test-suite-spec");
  ASSERT_TRUE(json_str.find("\"schemaVersion\":1") != std::string::npos);
  ASSERT_TRUE(json_str.find("\"test-suite-spec\"") != std::string::npos);

  auto parsed = WorkloadGenerator::from_json(json_str);
  ASSERT_EQ(parsed.size(), original.size());

  for (std::size_t i = 0; i < original.size(); ++i) {
    ASSERT_EQ(parsed[i].pid, original[i].pid);
    ASSERT_EQ(parsed[i].arrival_time, original[i].arrival_time);
    ASSERT_EQ(parsed[i].base_priority, original[i].base_priority);
    ASSERT_EQ(parsed[i].nice_value, original[i].nice_value);
    ASSERT_EQ(parsed[i].bursts.size(), original[i].bursts.size());
    for (std::size_t b = 0; b < original[i].bursts.size(); ++b) {
      ASSERT_EQ(static_cast<int>(parsed[i].bursts[b].kind), static_cast<int>(original[i].bursts[b].kind));
      ASSERT_EQ(parsed[i].bursts[b].duration, original[i].bursts[b].duration);
    }
  }
}
