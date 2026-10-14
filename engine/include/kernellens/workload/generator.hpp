#pragma once

#include "kernellens/core/types.hpp"
#include <vector>
#include <random>

namespace kernellens {

struct WorkloadGeneratorConfig {
  std::uint64_t seed = 42;
  std::size_t num_processes = 5;
  Tick max_arrival_time = 20;
  Tick min_burst = 2;
  Tick max_burst = 25;
  double io_probability = 0.3;
  Tick min_io_duration = 2;
  Tick max_io_duration = 10;
  int min_priority = 0;
  int max_priority = 10;
};

class WorkloadGenerator {
public:
  explicit WorkloadGenerator(WorkloadGeneratorConfig config = {});

  std::vector<ProcessSpec> generate();
  std::vector<std::uint32_t> generate_disk_requests(std::size_t count, std::uint32_t max_cylinder = 199);
  std::vector<std::uint32_t> generate_page_reference_string(std::size_t length, std::uint32_t num_unique_pages = 10);

  void set_seed(std::uint64_t seed);

private:
  WorkloadGeneratorConfig config_;
  std::mt19937_64 rng_;
};

} // namespace kernellens
