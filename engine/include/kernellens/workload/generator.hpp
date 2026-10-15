#pragma once

#include "kernellens/core/types.hpp"
#include <vector>
#include <random>
#include <string>

namespace kernellens {

enum class DistributionType {
  Uniform,
  Exponential,
  Bimodal,
  Normal
};

enum class DiskPatternType {
  Uniform,
  Clustered,
  Sequential
};

enum class MemoryPatternType {
  Uniform,
  Locality8020,
  Looping
};

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
  DistributionType burst_distribution = DistributionType::Uniform;
};

class WorkloadGenerator {
public:
  explicit WorkloadGenerator(WorkloadGeneratorConfig config = {});

  std::vector<ProcessSpec> generate();
  std::vector<std::uint32_t> generate_disk_requests(std::size_t count,
                                                    std::uint32_t max_cylinder = 199,
                                                    DiskPatternType pattern = DiskPatternType::Uniform);
  std::vector<std::uint32_t> generate_page_reference_string(std::size_t length,
                                                            std::uint32_t num_unique_pages = 10,
                                                            MemoryPatternType pattern = MemoryPatternType::Uniform);

  void set_seed(std::uint64_t seed);
  std::uint64_t seed() const noexcept { return config_.seed; }

  // Workload JSON Serialization & Deserialization (schemaVersion: 1)
  static std::string to_json(const std::vector<ProcessSpec>& specs, const std::string& name = "workload");
  static std::vector<ProcessSpec> from_json(const std::string& json_str);
  static bool save_to_file(const std::string& filepath, const std::vector<ProcessSpec>& specs, const std::string& name = "workload");
  static std::vector<ProcessSpec> load_from_file(const std::string& filepath);

private:
  Tick sample_burst();

  WorkloadGeneratorConfig config_;
  std::mt19937_64 rng_;
};

} // namespace kernellens
