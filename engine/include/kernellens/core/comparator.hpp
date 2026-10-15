#pragma once

#include "kernellens/core/types.hpp"
#include "kernellens/core/metrics.hpp"
#include "kernellens/disk/disk_scheduler.hpp"
#include "kernellens/memory/paging_system.hpp"
#include "kernellens/memory/allocator.hpp"
#include <string>
#include <vector>
#include <optional>

namespace kernellens {

struct MetricDelta {
  std::string metric_name;
  double baseline_value = 0.0;
  double policy_value = 0.0;
  double absolute_delta = 0.0; // policy - baseline
  double percent_change = 0.0;  // ((policy - baseline) / baseline) * 100%
  bool is_improvement = false;
};

// -------------------------------------------------------------
// CPU Comparison Data Structures
// -------------------------------------------------------------

struct CpuPolicyComparison {
  std::string policy;
  SimulationMetrics metrics;
  Tick duration = 0;
  std::size_t total_events = 0;
  std::vector<MetricDelta> deltas;
  std::vector<std::string> badges;
  int rank = 1;
};

struct CpuComparisonReport {
  std::string baseline_policy;
  std::vector<ProcessSpec> workload;
  std::vector<CpuPolicyComparison> results;

  std::string to_json() const;
  std::string to_table() const;
  std::string to_csv() const;
};

// -------------------------------------------------------------
// Disk Comparison Data Structures
// -------------------------------------------------------------

struct DiskPolicyComparison {
  std::string policy;
  DiskScheduleResult result;
  std::vector<MetricDelta> deltas;
  std::vector<std::string> badges;
  int rank = 1;
};

struct DiskComparisonReport {
  std::string baseline_policy;
  std::uint32_t initial_head = 0;
  std::vector<std::uint32_t> requests;
  std::vector<DiskPolicyComparison> results;

  std::string to_json() const;
  std::string to_table() const;
  std::string to_csv() const;
};

// -------------------------------------------------------------
// Memory Paging Comparison Data Structures
// -------------------------------------------------------------

struct MemoryPolicyComparison {
  std::string policy;
  PagingMetrics metrics;
  std::vector<MetricDelta> deltas;
  std::vector<std::string> badges;
  int rank = 1;
};

struct MemoryComparisonReport {
  std::string baseline_policy;
  std::size_t num_frames = 0;
  std::vector<std::uint32_t> reference_string;
  std::vector<MemoryPolicyComparison> results;

  std::string to_json() const;
  std::string to_table() const;
  std::string to_csv() const;
};

// -------------------------------------------------------------
// Memory Allocator Comparison Data Structures (Phase 9)
// -------------------------------------------------------------

struct AllocatorPolicyComparison {
  std::string policy;
  std::size_t successful_allocations = 0;
  std::size_t failed_allocations = 0;
  std::size_t total_allocated_bytes = 0;
  MemoryMetrics final_metrics;
  std::vector<MetricDelta> deltas;
  std::vector<std::string> badges;
  int rank = 1;
};

struct AllocatorComparisonReport {
  std::string baseline_policy;
  std::size_t capacity = 0;
  std::vector<AllocatorOp> operations;
  std::vector<AllocatorPolicyComparison> results;

  std::string to_json() const;
  std::string to_table() const;
  std::string to_csv() const;
};

// -------------------------------------------------------------
// Central Comparison Engine
// -------------------------------------------------------------

class ComparisonEngine {
public:
  static CpuComparisonReport compare_cpu(
      const std::vector<ProcessSpec>& workload,
      const std::vector<std::string>& policies,
      const std::string& baseline = "FCFS",
      Tick quantum = 3,
      Tick aging = 5,
      Tick context_switch_cost = 0);

  static DiskComparisonReport compare_disk(
      const std::vector<std::uint32_t>& requests,
      std::uint32_t initial_head,
      HeadDirection direction,
      std::uint32_t max_cylinder,
      const std::vector<std::string>& policies,
      const std::string& baseline = "FCFS");

  static MemoryComparisonReport compare_memory(
      const std::vector<std::uint32_t>& reference_string,
      std::size_t num_frames,
      const std::vector<std::string>& policies,
      const std::string& baseline = "FIFO");

  static AllocatorComparisonReport compare_allocator(
      std::size_t capacity,
      const std::vector<AllocatorOp>& operations,
      const std::vector<std::string>& policies = {"FIRST_FIT", "BEST_FIT", "WORST_FIT", "BUDDY"},
      const std::string& baseline = "FIRST_FIT");
};

} // namespace kernellens
