#include "kernellens/workload/generator.hpp"
#include <algorithm>
#include <sstream>
#include <fstream>
#include <cmath>
#include <cctype>

namespace kernellens {

WorkloadGenerator::WorkloadGenerator(WorkloadGeneratorConfig config)
    : config_(config), rng_(config.seed) {}

void WorkloadGenerator::set_seed(std::uint64_t seed) {
  config_.seed = seed;
  rng_.seed(seed);
}

Tick WorkloadGenerator::sample_burst() {
  Tick min_b = std::max<Tick>(1, config_.min_burst);
  Tick max_b = std::max<Tick>(min_b, config_.max_burst);

  switch (config_.burst_distribution) {
    case DistributionType::Exponential: {
      double mean = static_cast<double>(min_b + max_b) / 2.0;
      double lambda = 1.0 / std::max(1.0, mean);
      std::exponential_distribution<double> exp_dist(lambda);
      double val = exp_dist(rng_);
      Tick b = static_cast<Tick>(std::round(val));
      return std::clamp<Tick>(b, min_b, max_b * 2);
    }
    case DistributionType::Bimodal: {
      std::uniform_real_distribution<double> prob(0.0, 1.0);
      if (prob(rng_) < 0.75) {
        // Short interactive burst
        std::uniform_int_distribution<Tick> short_dist(min_b, std::min<Tick>(min_b + 3, max_b));
        return short_dist(rng_);
      } else {
        // Long CPU-bound batch burst
        Tick long_min = std::max<Tick>(min_b + 4, max_b > 5 ? max_b - 5 : max_b);
        std::uniform_int_distribution<Tick> long_dist(long_min, max_b * 2);
        return long_dist(rng_);
      }
    }
    case DistributionType::Normal: {
      double mean = static_cast<double>(min_b + max_b) / 2.0;
      double stddev = std::max(1.0, static_cast<double>(max_b - min_b) / 4.0);
      std::normal_distribution<double> norm_dist(mean, stddev);
      double val = norm_dist(rng_);
      Tick b = static_cast<Tick>(std::round(val));
      return std::clamp<Tick>(b, 1, max_b * 2);
    }
    case DistributionType::Uniform:
    default: {
      std::uniform_int_distribution<Tick> dist(min_b, max_b);
      return dist(rng_);
    }
  }
}

std::vector<ProcessSpec> WorkloadGenerator::generate() {
  std::uniform_int_distribution<Tick> arrival_dist(0, std::max<Tick>(0, config_.max_arrival_time));
  std::uniform_int_distribution<Tick> io_dist(config_.min_io_duration, std::max(config_.min_io_duration, config_.max_io_duration));
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

    // Initial CPU burst
    sp.bursts.push_back({BurstKind::Cpu, sample_burst()});

    // Optional follow-up IO and CPU burst
    if (prob_dist(rng_) < config_.io_probability) {
      sp.bursts.push_back({BurstKind::Io, io_dist(rng_)});
      sp.bursts.push_back({BurstKind::Cpu, sample_burst()});
    }

    specs.push_back(std::move(sp));
  }

  // Sort by arrival time, then by PID for total input determinism
  std::sort(specs.begin(), specs.end(), [](const ProcessSpec& a, const ProcessSpec& b) {
    if (a.arrival_time != b.arrival_time) return a.arrival_time < b.arrival_time;
    return a.pid < b.pid;
  });

  return specs;
}

std::vector<std::uint32_t> WorkloadGenerator::generate_disk_requests(std::size_t count,
                                                                    std::uint32_t max_cylinder,
                                                                    DiskPatternType pattern) {
  std::vector<std::uint32_t> reqs;
  reqs.reserve(count);

  if (max_cylinder == 0) {
    reqs.assign(count, 0);
    return reqs;
  }

  if (pattern == DiskPatternType::Clustered) {
    // 80% requests in a localized cylinder cluster (hotspot)
    std::uint32_t cluster_size = std::max<std::uint32_t>(5, max_cylinder / 5);
    std::uniform_int_distribution<std::uint32_t> hotspot_dist(0, max_cylinder > cluster_size ? max_cylinder - cluster_size : 0);
    std::uint32_t hotspot_start = hotspot_dist(rng_);
    std::uniform_int_distribution<std::uint32_t> cluster_dist(hotspot_start, hotspot_start + cluster_size);
    std::uniform_int_distribution<std::uint32_t> global_dist(0, max_cylinder);
    std::uniform_real_distribution<double> prob(0.0, 1.0);

    for (std::size_t i = 0; i < count; ++i) {
      if (prob(rng_) < 0.80) {
        reqs.push_back(std::min(max_cylinder, cluster_dist(rng_)));
      } else {
        reqs.push_back(global_dist(rng_));
      }
    }
  } else if (pattern == DiskPatternType::Sequential) {
    std::uniform_int_distribution<std::uint32_t> start_dist(0, max_cylinder / 2);
    std::uint32_t current = start_dist(rng_);
    std::uniform_int_distribution<std::uint32_t> step_dist(1, 4);
    std::uniform_real_distribution<double> jump_prob(0.0, 1.0);

    for (std::size_t i = 0; i < count; ++i) {
      reqs.push_back(current);
      if (jump_prob(rng_) < 0.15) {
        // Random jump
        std::uniform_int_distribution<std::uint32_t> jump_dist(0, max_cylinder);
        current = jump_dist(rng_);
      } else {
        current = (current + step_dist(rng_)) % (max_cylinder + 1);
      }
    }
  } else {
    // Uniform random
    std::uniform_int_distribution<std::uint32_t> cyl_dist(0, max_cylinder);
    for (std::size_t i = 0; i < count; ++i) {
      reqs.push_back(cyl_dist(rng_));
    }
  }

  return reqs;
}

std::vector<std::uint32_t> WorkloadGenerator::generate_page_reference_string(std::size_t length,
                                                                            std::uint32_t num_unique_pages,
                                                                            MemoryPatternType pattern) {
  std::vector<std::uint32_t> refs;
  refs.reserve(length);

  if (num_unique_pages == 0) {
    refs.assign(length, 0);
    return refs;
  }

  if (pattern == MemoryPatternType::Locality8020) {
    // 80% references to 20% of pages
    std::uint32_t hot_count = std::max<std::uint32_t>(1, num_unique_pages / 5);
    std::uniform_int_distribution<std::uint32_t> hot_dist(0, hot_count - 1);
    std::uniform_int_distribution<std::uint32_t> cold_dist(hot_count, num_unique_pages - 1);
    std::uniform_real_distribution<double> prob(0.0, 1.0);

    for (std::size_t i = 0; i < length; ++i) {
      if (prob(rng_) < 0.80 || hot_count == num_unique_pages) {
        refs.push_back(hot_dist(rng_));
      } else {
        refs.push_back(cold_dist(rng_));
      }
    }
  } else if (pattern == MemoryPatternType::Looping) {
    // Cyclically references a working set
    std::uint32_t working_set = std::max<std::uint32_t>(3, num_unique_pages);
    for (std::size_t i = 0; i < length; ++i) {
      refs.push_back(static_cast<std::uint32_t>(i % working_set));
    }
  } else {
    // Uniform
    std::uniform_int_distribution<std::uint32_t> page_dist(0, num_unique_pages - 1);
    for (std::size_t i = 0; i < length; ++i) {
      refs.push_back(page_dist(rng_));
    }
  }

  return refs;
}

std::string WorkloadGenerator::to_json(const std::vector<ProcessSpec>& specs, const std::string& name) {
  std::ostringstream ss;
  ss << "{"
     << "\"schemaVersion\":1,"
     << "\"name\":\"" << name << "\","
     << "\"processCount\":" << specs.size() << ","
     << "\"processes\":[";

  for (std::size_t i = 0; i < specs.size(); ++i) {
    if (i > 0) ss << ",";
    const auto& sp = specs[i];
    ss << "{"
       << "\"pid\":" << sp.pid << ","
       << "\"arrivalTime\":" << sp.arrival_time << ","
       << "\"basePriority\":" << sp.base_priority << ","
       << "\"niceValue\":" << sp.nice_value << ","
       << "\"bursts\":[";
    for (std::size_t b = 0; b < sp.bursts.size(); ++b) {
      if (b > 0) ss << ",";
      ss << "{"
         << "\"kind\":\"" << (sp.bursts[b].kind == BurstKind::Cpu ? "CPU" : "IO") << "\","
         << "\"duration\":" << sp.bursts[b].duration
         << "}";
    }
    ss << "]}";
  }
  ss << "]}";
  return ss.str();
}

// Lightweight, deterministic JSON parser for ProcessSpec list
std::vector<ProcessSpec> WorkloadGenerator::from_json(const std::string& json_str) {
  std::vector<ProcessSpec> result;
  std::size_t pos = 0;

  auto skip_ws = [&](std::size_t& p) {
    while (p < json_str.size() && (std::isspace(json_str[p]) || json_str[p] == ',' || json_str[p] == ':')) {
      p++;
    }
  };

  // Locate "processes" array
  auto proc_idx = json_str.find("\"processes\"");
  if (proc_idx == std::string::npos) {
    return result;
  }

  auto arr_start = json_str.find('[', proc_idx);
  if (arr_start == std::string::npos) return result;

  pos = arr_start + 1;

  while (pos < json_str.size()) {
    skip_ws(pos);
    if (pos >= json_str.size() || json_str[pos] == ']') break;
    if (json_str[pos] != '{') {
      pos++;
      continue;
    }

    // Find end of current process object
    std::size_t obj_start = pos;
    int brace_count = 0;
    std::size_t obj_end = std::string::npos;
    for (std::size_t i = obj_start; i < json_str.size(); ++i) {
      if (json_str[i] == '{') brace_count++;
      else if (json_str[i] == '}') {
        brace_count--;
        if (brace_count == 0) {
          obj_end = i;
          break;
        }
      }
    }

    if (obj_end == std::string::npos) break;

    std::string obj_text = json_str.substr(obj_start, obj_end - obj_start + 1);
    pos = obj_end + 1;

    ProcessSpec spec;
    spec.pid = 0;
    spec.arrival_time = 0;
    spec.base_priority = 0;
    spec.nice_value = 0;

    auto find_num = [&](const std::string& key, int64_t def) -> int64_t {
      auto kpos = obj_text.find("\"" + key + "\"");
      if (kpos == std::string::npos) return def;
      auto colon = obj_text.find(':', kpos);
      if (colon == std::string::npos) return def;
      std::size_t num_start = colon + 1;
      while (num_start < obj_text.size() && (std::isspace(obj_text[num_start]) || obj_text[num_start] == '\"')) {
        num_start++;
      }
      std::size_t num_end = num_start;
      while (num_end < obj_text.size() && (std::isdigit(obj_text[num_end]) || obj_text[num_end] == '-')) {
        num_end++;
      }
      if (num_end > num_start) {
        try {
          return std::stoll(obj_text.substr(num_start, num_end - num_start));
        } catch (...) {}
      }
      return def;
    };

    spec.pid = static_cast<ProcessId>(find_num("pid", 1));
    spec.arrival_time = static_cast<Tick>(find_num("arrivalTime", 0));
    spec.base_priority = static_cast<int>(find_num("basePriority", 0));
    spec.nice_value = static_cast<int>(find_num("niceValue", 0));

    // Bursts array inside object
    auto bidx = obj_text.find("\"bursts\"");
    if (bidx != std::string::npos) {
      auto b_start = obj_text.find('[', bidx);
      auto b_close = obj_text.find(']', b_start);
      if (b_start != std::string::npos && b_close != std::string::npos) {
        std::string bursts_str = obj_text.substr(b_start, b_close - b_start + 1);
        std::size_t bp = 0;
        while ((bp = bursts_str.find('{', bp)) != std::string::npos) {
          auto bend = bursts_str.find('}', bp);
          if (bend == std::string::npos) break;
          std::string bitem = bursts_str.substr(bp, bend - bp + 1);
          bp = bend + 1;

          BurstKind kind = BurstKind::Cpu;
          if (bitem.find("\"IO\"") != std::string::npos || bitem.find("\"io\"") != std::string::npos) {
            kind = BurstKind::Io;
          }

          Tick dur = 1;
          auto dpos = bitem.find("\"duration\"");
          if (dpos != std::string::npos) {
            auto dcolon = bitem.find(':', dpos);
            if (dcolon != std::string::npos) {
              std::size_t ds = dcolon + 1;
              while (ds < bitem.size() && !std::isdigit(bitem[ds])) ds++;
              std::size_t de = ds;
              while (de < bitem.size() && std::isdigit(bitem[de])) de++;
              if (de > ds) {
                try {
                  dur = std::stoll(bitem.substr(ds, de - ds));
                } catch (...) {}
              }
            }
          }

          spec.bursts.push_back({kind, dur});
        }
      }
    }

    if (spec.bursts.empty()) {
      spec.bursts.push_back({BurstKind::Cpu, 1});
    }

    result.push_back(spec);
  }

  // Ensure deterministic sort
  std::sort(result.begin(), result.end(), [](const ProcessSpec& a, const ProcessSpec& b) {
    if (a.arrival_time != b.arrival_time) return a.arrival_time < b.arrival_time;
    return a.pid < b.pid;
  });

  return result;
}

bool WorkloadGenerator::save_to_file(const std::string& filepath, const std::vector<ProcessSpec>& specs, const std::string& name) {
  std::ofstream out(filepath);
  if (!out.is_open()) return false;
  out << to_json(specs, name);
  return true;
}

std::vector<ProcessSpec> WorkloadGenerator::load_from_file(const std::string& filepath) {
  std::ifstream in(filepath);
  if (!in.is_open()) return {};
  std::ostringstream ss;
  ss << in.rdbuf();
  return from_json(ss.str());
}

} // namespace kernellens
