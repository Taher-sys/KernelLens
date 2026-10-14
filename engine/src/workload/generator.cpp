#include "kernellens/workload/generator.hpp"
#include <algorithm>

namespace kernellens {

WorkloadGenerator::WorkloadGenerator(WorkloadGeneratorConfig config)
    : config_(config), rng_(config.seed) {}

void WorkloadGenerator::set_seed(std::uint64_t seed) {
  config_.seed = seed;
  rng_.seed(seed);
}

std::vector<ProcessSpec> WorkloadGenerator::generate() {
  std::uniform_int_distribution<Tick> arrival_dist(0, config_.max_arrival_time);
  std::uniform_int_distribution<Tick> burst_dist(config_.min_burst, config_.max_burst);
  std::uniform_int_distribution<Tick> io_dist(config_.min_io_duration, config_.max_io_duration);
  std::uniform_real_distribution<double> prob_dist(0.0, 1.0);
  std::uniform_int_distribution<int> prio_dist(config_.min_priority, config_.max_priority);
  std::uniform_int_distribution<int> nice_dist(-20, 19);

  std::vector<ProcessSpec> specs;
  specs.reserve(config_.num_processes);

  for (std::size_t i = 1; i <= config_.num_processes; ++i) {
    ProcessSpec sp;
    sp.pid = static_cast<ProcessId>(i);
    sp.arrival_time = arrival_dist(rng_);
    sp.base_priority = prio_dist(rng_);
    sp.nice_value = nice_dist(rng_);

    // Always start with CPU burst
    sp.bursts.push_back({BurstKind::Cpu, burst_dist(rng_)});

    // Optional follow-up IO and CPU burst
    if (prob_dist(rng_) < config_.io_probability) {
      sp.bursts.push_back({BurstKind::Io, io_dist(rng_)});
      sp.bursts.push_back({BurstKind::Cpu, burst_dist(rng_)});
    }

    specs.push_back(std::move(sp));
  }

  // Sort by arrival time for standard input presentation
  std::sort(specs.begin(), specs.end(), [](const ProcessSpec& a, const ProcessSpec& b) {
    if (a.arrival_time != b.arrival_time) return a.arrival_time < b.arrival_time;
    return a.pid < b.pid;
  });

  return specs;
}

std::vector<std::uint32_t> WorkloadGenerator::generate_disk_requests(std::size_t count, std::uint32_t max_cylinder) {
  std::uniform_int_distribution<std::uint32_t> cyl_dist(0, max_cylinder);
  std::vector<std::uint32_t> reqs;
  reqs.reserve(count);
  for (std::size_t i = 0; i < count; ++i) {
    reqs.push_back(cyl_dist(rng_));
  }
  return reqs;
}

std::vector<std::uint32_t> WorkloadGenerator::generate_page_reference_string(std::size_t length, std::uint32_t num_unique_pages) {
  std::uniform_int_distribution<std::uint32_t> page_dist(0, num_unique_pages > 0 ? num_unique_pages - 1 : 0);
  std::vector<std::uint32_t> refs;
  refs.reserve(length);
  for (std::size_t i = 0; i < length; ++i) {
    refs.push_back(page_dist(rng_));
  }
  return refs;
}

} // namespace kernellens
