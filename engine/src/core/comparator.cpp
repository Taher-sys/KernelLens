#include "kernellens/core/comparator.hpp"
#include "kernellens/core/engine.hpp"
#include "kernellens/cpu/fcfs.hpp"
#include "kernellens/cpu/sjf.hpp"
#include "kernellens/cpu/srtf.hpp"
#include "kernellens/cpu/priority.hpp"
#include "kernellens/cpu/round_robin.hpp"
#include "kernellens/cpu/mlfq.hpp"
#include "kernellens/cpu/cfs_like.hpp"
#include "kernellens/disk/schedulers.hpp"
#include "kernellens/memory/replacers.hpp"

#include <algorithm>
#include <sstream>
#include <iomanip>
#include <cmath>

namespace kernellens {

static MetricDelta compute_delta(const std::string& name, double baseline, double current, bool lower_is_better) {
  MetricDelta d;
  d.metric_name = name;
  d.baseline_value = baseline;
  d.policy_value = current;
  d.absolute_delta = current - baseline;
  if (std::abs(baseline) > 1e-9) {
    d.percent_change = ((current - baseline) / baseline) * 100.0;
  } else {
    d.percent_change = 0.0;
  }
  d.is_improvement = lower_is_better ? (current < baseline) : (current > baseline);
  return d;
}

static std::unique_ptr<IScheduler> create_cpu_scheduler(const std::string& name, Tick quantum, Tick aging) {
  if (name == "FCFS") return std::make_unique<FcfsScheduler>();
  if (name == "SJF") return std::make_unique<SjfScheduler>();
  if (name == "SRTF") return std::make_unique<SrtfScheduler>();
  if (name == "PRIORITY") return std::make_unique<PriorityScheduler>(true, aging);
  if (name == "ROUND_ROBIN" || name == "RR") return std::make_unique<RoundRobinScheduler>(quantum);
  if (name == "MLFQ") return std::make_unique<MlfqScheduler>(std::vector<Tick>{quantum, quantum * 2, quantum * 4});
  if (name == "CFS_LIKE" || name == "CFS") return std::make_unique<CfsLikeScheduler>(quantum * 2);
  return std::make_unique<FcfsScheduler>();
}

static std::unique_ptr<IDiskScheduler> create_disk_scheduler(const std::string& name) {
  if (name == "SSTF") return std::make_unique<DiskSstfScheduler>();
  if (name == "SCAN") return std::make_unique<DiskScanScheduler>();
  if (name == "C-SCAN" || name == "CSCAN") return std::make_unique<DiskCScanScheduler>();
  if (name == "LOOK") return std::make_unique<DiskLookScheduler>();
  if (name == "C-LOOK" || name == "CLOOK") return std::make_unique<DiskCLookScheduler>();
  return std::make_unique<DiskFcfsScheduler>();
}

static std::unique_ptr<IPageReplacer> create_page_replacer(const std::string& name) {
  if (name == "LRU") return std::make_unique<LruReplacer>();
  if (name == "OPTIMAL" || name == "OPT") return std::make_unique<OptimalReplacer>();
  if (name == "CLOCK") return std::make_unique<ClockReplacer>();
  return std::make_unique<FifoReplacer>();
}

// ----------------------------------------------------------------------------
// CPU Comparison Implementation
// ----------------------------------------------------------------------------

CpuComparisonReport ComparisonEngine::compare_cpu(
    const std::vector<ProcessSpec>& workload,
    const std::vector<std::string>& policies,
    const std::string& baseline,
    Tick quantum,
    Tick aging,
    Tick context_switch_cost) {

  CpuComparisonReport report;
  report.baseline_policy = baseline;
  report.workload = workload;

  std::optional<SimulationMetrics> baseline_metrics;

  for (const auto& pol_name : policies) {
    SimulationConfig config;
    config.run_id = "comp-" + pol_name;
    config.context_switch_cost = context_switch_cost;

    SimulationEngine engine(config);
    engine.set_scheduler(create_cpu_scheduler(pol_name, quantum, aging));
    engine.load_workload(workload);
    engine.run();

    CpuPolicyComparison item;
    item.policy = pol_name;
    item.metrics = engine.metrics();
    item.duration = engine.current_tick();
    item.total_events = engine.event_log().size();

    if (pol_name == baseline) {
      baseline_metrics = item.metrics;
    }

    report.results.push_back(std::move(item));
  }

  // If baseline wasn't in policies, run baseline specifically
  if (!baseline_metrics.has_value()) {
    SimulationConfig config;
    config.run_id = "comp-baseline-" + baseline;
    config.context_switch_cost = context_switch_cost;

    SimulationEngine b_engine(config);
    b_engine.set_scheduler(create_cpu_scheduler(baseline, quantum, aging));
    b_engine.load_workload(workload);
    b_engine.run();
    baseline_metrics = b_engine.metrics();
  }

  const auto& bm = *baseline_metrics;

  // Compute deltas against baseline
  for (auto& res : report.results) {
    res.deltas.push_back(compute_delta("waitingTime", bm.averages.waiting_time, res.metrics.averages.waiting_time, true));
    res.deltas.push_back(compute_delta("turnaroundTime", bm.averages.turnaround_time, res.metrics.averages.turnaround_time, true));
    res.deltas.push_back(compute_delta("responseTime", bm.averages.response_time, res.metrics.averages.response_time, true));
    res.deltas.push_back(compute_delta("contextSwitches", static_cast<double>(bm.context_switches), static_cast<double>(res.metrics.context_switches), true));
    res.deltas.push_back(compute_delta("cpuUtilization", bm.cpu_utilization, res.metrics.cpu_utilization, false));
    res.deltas.push_back(compute_delta("throughput", bm.throughput, res.metrics.throughput, false));
    if (bm.jain_fairness.has_value() && res.metrics.jain_fairness.has_value()) {
      res.deltas.push_back(compute_delta("jainFairness", *bm.jain_fairness, *res.metrics.jain_fairness, false));
    }
  }

  // Identify best-in-class badges
  if (!report.results.empty()) {
    double min_wait = report.results[0].metrics.averages.waiting_time;
    double min_turnaround = report.results[0].metrics.averages.turnaround_time;
    double min_response = report.results[0].metrics.averages.response_time;
    std::size_t min_switches = report.results[0].metrics.context_switches;
    double max_fairness = report.results[0].metrics.jain_fairness.value_or(0.0);

    for (const auto& r : report.results) {
      if (r.metrics.averages.waiting_time < min_wait) min_wait = r.metrics.averages.waiting_time;
      if (r.metrics.averages.turnaround_time < min_turnaround) min_turnaround = r.metrics.averages.turnaround_time;
      if (r.metrics.averages.response_time < min_response) min_response = r.metrics.averages.response_time;
      if (r.metrics.context_switches < min_switches) min_switches = r.metrics.context_switches;
      if (r.metrics.jain_fairness.value_or(0.0) > max_fairness) max_fairness = r.metrics.jain_fairness.value_or(0.0);
    }

    for (auto& r : report.results) {
      if (std::abs(r.metrics.averages.waiting_time - min_wait) < 1e-4) r.badges.push_back("Lowest Wait");
      if (std::abs(r.metrics.averages.turnaround_time - min_turnaround) < 1e-4) r.badges.push_back("Lowest Turnaround");
      if (std::abs(r.metrics.averages.response_time - min_response) < 1e-4) r.badges.push_back("Lowest Response");
      if (r.metrics.context_switches == min_switches) r.badges.push_back("Fewest Switches");
      if (r.metrics.jain_fairness.has_value() && std::abs(*r.metrics.jain_fairness - max_fairness) < 1e-4 && max_fairness > 0.0) {
        r.badges.push_back("Most Fair");
      }
    }

    // Rank policies primarily by average waiting time
    std::vector<std::size_t> indices(report.results.size());
    for (std::size_t i = 0; i < indices.size(); ++i) indices[i] = i;
    std::sort(indices.begin(), indices.end(), [&](std::size_t a, std::size_t b) {
      return report.results[a].metrics.averages.waiting_time < report.results[b].metrics.averages.waiting_time;
    });
    for (std::size_t rank = 0; rank < indices.size(); ++rank) {
      report.results[indices[rank]].rank = static_cast<int>(rank + 1);
    }
  }

  return report;
}

std::string CpuComparisonReport::to_json() const {
  std::ostringstream ss;
  ss << std::fixed << std::setprecision(4);
  ss << "{"
     << "\"schemaVersion\":1,"
     << "\"baselinePolicy\":\"" << baseline_policy << "\","
     << "\"policyCount\":" << results.size() << ","
     << "\"results\":[";

  for (std::size_t i = 0; i < results.size(); ++i) {
    if (i > 0) ss << ",";
    const auto& r = results[i];
    ss << "{"
       << "\"policy\":\"" << r.policy << "\","
       << "\"rank\":" << r.rank << ","
       << "\"duration\":" << r.duration << ","
       << "\"totalEvents\":" << r.total_events << ","
       << "\"metrics\":" << r.metrics.to_json() << ","
       << "\"deltas\":[";
    for (std::size_t d = 0; d < r.deltas.size(); ++d) {
      if (d > 0) ss << ",";
      const auto& delta = r.deltas[d];
      ss << "{"
         << "\"metric\":\"" << delta.metric_name << "\","
         << "\"baseline\":" << delta.baseline_value << ","
         << "\"value\":" << delta.policy_value << ","
         << "\"delta\":" << delta.absolute_delta << ","
         << "\"percentChange\":" << delta.percent_change << ","
         << "\"isImprovement\":" << (delta.is_improvement ? "true" : "false")
         << "}";
    }
    ss << "],"
       << "\"badges\":[";
    for (std::size_t b = 0; b < r.badges.size(); ++b) {
      if (b > 0) ss << ",";
      ss << "\"" << r.badges[b] << "\"";
    }
    ss << "]}";
  }
  ss << "]}";
  return ss.str();
}

std::string CpuComparisonReport::to_table() const {
  std::ostringstream ss;
  ss << "========================================================================================================================\n"
     << " KernelLens CPU Multi-Policy Comparative Analysis (Baseline: " << baseline_policy << ")\n"
     << "========================================================================================================================\n"
     << std::left << std::setw(6) << "Rank"
     << std::setw(14) << "Policy"
     << std::setw(12) << "Avg Wait"
     << std::setw(14) << "Delta Wait"
     << std::setw(12) << "Avg Turn"
     << std::setw(14) << "Delta Turn"
     << std::setw(10) << "Switches"
     << std::setw(12) << "Fairness"
     << "Badges\n"
     << "------------------------------------------------------------------------------------------------------------------------\n";

  for (const auto& r : results) {
    double d_wait = 0.0;
    double d_turn = 0.0;
    for (const auto& d : r.deltas) {
      if (d.metric_name == "waitingTime") d_wait = d.absolute_delta;
      if (d.metric_name == "turnaroundTime") d_turn = d.absolute_delta;
    }

    std::ostringstream w_ss, t_ss;
    w_ss << (d_wait >= 0 ? "+" : "") << std::fixed << std::setprecision(2) << d_wait;
    t_ss << (d_turn >= 0 ? "+" : "") << std::fixed << std::setprecision(2) << d_turn;

    std::string badge_str;
    for (std::size_t b = 0; b < r.badges.size(); ++b) {
      if (b > 0) badge_str += ", ";
      badge_str += "[" + r.badges[b] + "]";
    }

    ss << std::left << std::setw(6) << r.rank
       << std::setw(14) << r.policy
       << std::setw(12) << std::fixed << std::setprecision(2) << r.metrics.averages.waiting_time
       << std::setw(14) << w_ss.str()
       << std::setw(12) << std::fixed << std::setprecision(2) << r.metrics.averages.turnaround_time
       << std::setw(14) << t_ss.str()
       << std::setw(10) << r.metrics.context_switches
       << std::setw(12) << std::fixed << std::setprecision(4) << r.metrics.jain_fairness.value_or(1.0)
       << badge_str << "\n";
  }
  ss << "========================================================================================================================\n";
  return ss.str();
}

std::string CpuComparisonReport::to_csv() const {
  std::ostringstream ss;
  ss << "rank,policy,waiting_time,delta_waiting,turnaround_time,delta_turnaround,response_time,context_switches,cpu_utilization,throughput,fairness,badges\n";
  for (const auto& r : results) {
    double d_wait = 0.0, d_turn = 0.0;
    for (const auto& d : r.deltas) {
      if (d.metric_name == "waitingTime") d_wait = d.absolute_delta;
      if (d.metric_name == "turnaroundTime") d_turn = d.absolute_delta;
    }
    std::string badge_str;
    for (std::size_t b = 0; b < r.badges.size(); ++b) {
      if (b > 0) badge_str += ";";
      badge_str += r.badges[b];
    }
    ss << r.rank << ","
       << r.policy << ","
       << r.metrics.averages.waiting_time << ","
       << d_wait << ","
       << r.metrics.averages.turnaround_time << ","
       << d_turn << ","
       << r.metrics.averages.response_time << ","
       << r.metrics.context_switches << ","
       << r.metrics.cpu_utilization << ","
       << r.metrics.throughput << ","
       << r.metrics.jain_fairness.value_or(1.0) << ",\""
       << badge_str << "\"\n";
  }
  return ss.str();
}

// ----------------------------------------------------------------------------
// Disk Comparison Implementation
// ----------------------------------------------------------------------------

DiskComparisonReport ComparisonEngine::compare_disk(
    const std::vector<std::uint32_t>& requests,
    std::uint32_t initial_head,
    HeadDirection direction,
    std::uint32_t max_cylinder,
    const std::vector<std::string>& policies,
    const std::string& baseline) {

  DiskComparisonReport report;
  report.baseline_policy = baseline;
  report.initial_head = initial_head;
  report.requests = requests;

  std::optional<std::uint64_t> baseline_seek;

  for (const auto& pol_name : policies) {
    auto sched = create_disk_scheduler(pol_name);
    auto res = sched->schedule(initial_head, direction, max_cylinder, requests, nullptr);

    DiskPolicyComparison item;
    item.policy = pol_name;
    item.result = res;

    if (pol_name == baseline) {
      baseline_seek = res.total_seek_distance;
    }

    report.results.push_back(std::move(item));
  }

  if (!baseline_seek.has_value()) {
    auto b_sched = create_disk_scheduler(baseline);
    auto b_res = b_sched->schedule(initial_head, direction, max_cylinder, requests, nullptr);
    baseline_seek = b_res.total_seek_distance;
  }

  double b_val = static_cast<double>(*baseline_seek);

  for (auto& r : report.results) {
    r.deltas.push_back(compute_delta("seekDistance", b_val, static_cast<double>(r.result.total_seek_distance), true));
  }

  if (!report.results.empty()) {
    std::uint64_t min_seek = report.results[0].result.total_seek_distance;
    for (const auto& r : report.results) {
      if (r.result.total_seek_distance < min_seek) min_seek = r.result.total_seek_distance;
    }
    for (auto& r : report.results) {
      if (r.result.total_seek_distance == min_seek) {
        r.badges.push_back("Minimum Seek Distance");
      }
    }

    std::vector<std::size_t> indices(report.results.size());
    for (std::size_t i = 0; i < indices.size(); ++i) indices[i] = i;
    std::sort(indices.begin(), indices.end(), [&](std::size_t a, std::size_t b) {
      return report.results[a].result.total_seek_distance < report.results[b].result.total_seek_distance;
    });
    for (std::size_t rank = 0; rank < indices.size(); ++rank) {
      report.results[indices[rank]].rank = static_cast<int>(rank + 1);
    }
  }

  return report;
}

std::string DiskComparisonReport::to_json() const {
  std::ostringstream ss;
  ss << "{"
     << "\"schemaVersion\":1,"
     << "\"baselinePolicy\":\"" << baseline_policy << "\","
     << "\"initialHead\":" << initial_head << ","
     << "\"results\":[";
  for (std::size_t i = 0; i < results.size(); ++i) {
    if (i > 0) ss << ",";
    const auto& r = results[i];
    ss << "{"
       << "\"policy\":\"" << r.policy << "\","
       << "\"rank\":" << r.rank << ","
       << "\"totalSeekDistance\":" << r.result.total_seek_distance << ","
       << "\"serviceOrder\":[";
    for (std::size_t s = 0; s < r.result.service_order.size(); ++s) {
      if (s > 0) ss << ",";
      ss << r.result.service_order[s];
    }
    ss << "],"
       << "\"deltas\":[";
    for (std::size_t d = 0; d < r.deltas.size(); ++d) {
      if (d > 0) ss << ",";
      const auto& delta = r.deltas[d];
      ss << "{"
         << "\"metric\":\"" << delta.metric_name << "\","
         << "\"baseline\":" << delta.baseline_value << ","
         << "\"value\":" << delta.policy_value << ","
         << "\"delta\":" << delta.absolute_delta << ","
         << "\"percentChange\":" << delta.percent_change << ","
         << "\"isImprovement\":" << (delta.is_improvement ? "true" : "false")
         << "}";
    }
    ss << "],"
       << "\"badges\":[";
    for (std::size_t b = 0; b < r.badges.size(); ++b) {
      if (b > 0) ss << ",";
      ss << "\"" << r.badges[b] << "\"";
    }
    ss << "]}";
  }
  ss << "]}";
  return ss.str();
}

std::string DiskComparisonReport::to_table() const {
  std::ostringstream ss;
  ss << "=========================================================================================\n"
     << " KernelLens Disk Multi-Policy Comparative Analysis (Baseline: " << baseline_policy << ")\n"
     << " Initial Head: " << initial_head << " | Requests: " << requests.size() << "\n"
     << "=========================================================================================\n"
     << std::left << std::setw(6) << "Rank"
     << std::setw(14) << "Policy"
     << std::setw(16) << "Total Seek (cyl)"
     << std::setw(14) << "Delta (cyl)"
     << std::setw(12) << "% Reduction"
     << "Badges\n"
     << "-----------------------------------------------------------------------------------------\n";

  for (const auto& r : results) {
    double d_seek = 0.0;
    double p_change = 0.0;
    for (const auto& d : r.deltas) {
      if (d.metric_name == "seekDistance") {
        d_seek = d.absolute_delta;
        p_change = d.percent_change;
      }
    }
    std::ostringstream d_ss, p_ss;
    d_ss << (d_seek >= 0 ? "+" : "") << static_cast<int64_t>(d_seek);
    p_ss << std::fixed << std::setprecision(1) << -p_change << " %";

    std::string badge_str;
    for (std::size_t b = 0; b < r.badges.size(); ++b) {
      if (b > 0) badge_str += ", ";
      badge_str += "[" + r.badges[b] + "]";
    }

    ss << std::left << std::setw(6) << r.rank
       << std::setw(14) << r.policy
       << std::setw(16) << r.result.total_seek_distance
       << std::setw(14) << d_ss.str()
       << std::setw(12) << p_ss.str()
       << badge_str << "\n";
  }
  ss << "=========================================================================================\n";
  return ss.str();
}

std::string DiskComparisonReport::to_csv() const {
  std::ostringstream ss;
  ss << "rank,policy,total_seek_distance,delta_seek,percent_reduction,badges\n";
  for (const auto& r : results) {
    double d_seek = 0.0, p_change = 0.0;
    for (const auto& d : r.deltas) {
      if (d.metric_name == "seekDistance") {
        d_seek = d.absolute_delta;
        p_change = d.percent_change;
      }
    }
    std::string badge_str;
    for (std::size_t b = 0; b < r.badges.size(); ++b) {
      if (b > 0) badge_str += ";";
      badge_str += r.badges[b];
    }
    ss << r.rank << ","
       << r.policy << ","
       << r.result.total_seek_distance << ","
       << d_seek << ","
       << -p_change << ",\""
       << badge_str << "\"\n";
  }
  return ss.str();
}

// ----------------------------------------------------------------------------
// Memory Comparison Implementation
// ----------------------------------------------------------------------------

MemoryComparisonReport ComparisonEngine::compare_memory(
    const std::vector<std::uint32_t>& reference_string,
    std::size_t num_frames,
    const std::vector<std::string>& policies,
    const std::string& baseline) {

  MemoryComparisonReport report;
  report.baseline_policy = baseline;
  report.num_frames = num_frames;
  report.reference_string = reference_string;

  std::optional<PagingMetrics> baseline_metrics;

  for (const auto& pol_name : policies) {
    auto replacer = create_page_replacer(pol_name);
    PagingSystem paging(num_frames, std::move(replacer), 4, nullptr);

    for (std::size_t i = 0; i < reference_string.size(); ++i) {
      paging.access(static_cast<Tick>(i), reference_string[i], i, reference_string);
    }

    MemoryPolicyComparison item;
    item.policy = pol_name;
    item.metrics = paging.metrics();

    if (pol_name == baseline) {
      baseline_metrics = item.metrics;
    }

    report.results.push_back(std::move(item));
  }

  if (!baseline_metrics.has_value()) {
    auto b_replacer = create_page_replacer(baseline);
    PagingSystem b_paging(num_frames, std::move(b_replacer), 4, nullptr);
    for (std::size_t i = 0; i < reference_string.size(); ++i) {
      b_paging.access(static_cast<Tick>(i), reference_string[i], i, reference_string);
    }
    baseline_metrics = b_paging.metrics();
  }

  const auto& bm = *baseline_metrics;
  for (auto& r : report.results) {
    r.deltas.push_back(compute_delta("pageFaults", static_cast<double>(bm.page_faults), static_cast<double>(r.metrics.page_faults), true));
    r.deltas.push_back(compute_delta("faultRate", bm.fault_rate, r.metrics.fault_rate, true));
    r.deltas.push_back(compute_delta("tlbHitRate", bm.tlb_hit_rate, r.metrics.tlb_hit_rate, false));
  }

  if (!report.results.empty()) {
    std::size_t min_faults = report.results[0].metrics.page_faults;
    for (const auto& r : report.results) {
      if (r.metrics.page_faults < min_faults) min_faults = r.metrics.page_faults;
    }
    for (auto& r : report.results) {
      if (r.metrics.page_faults == min_faults) {
        r.badges.push_back("Fewest Page Faults");
      }
      if (r.policy == "OPTIMAL" || r.policy == "OPT") {
        r.badges.push_back("Theoretical Lower Bound");
      }
    }

    std::vector<std::size_t> indices(report.results.size());
    for (std::size_t i = 0; i < indices.size(); ++i) indices[i] = i;
    std::sort(indices.begin(), indices.end(), [&](std::size_t a, std::size_t b) {
      return report.results[a].metrics.page_faults < report.results[b].metrics.page_faults;
    });
    for (std::size_t rank = 0; rank < indices.size(); ++rank) {
      report.results[indices[rank]].rank = static_cast<int>(rank + 1);
    }
  }

  return report;
}

std::string MemoryComparisonReport::to_json() const {
  std::ostringstream ss;
  ss << "{"
     << "\"schemaVersion\":1,"
     << "\"baselinePolicy\":\"" << baseline_policy << "\","
     << "\"numFrames\":" << num_frames << ","
     << "\"referenceCount\":" << reference_string.size() << ","
     << "\"results\":[";
  for (std::size_t i = 0; i < results.size(); ++i) {
    if (i > 0) ss << ",";
    const auto& r = results[i];
    ss << "{"
       << "\"policy\":\"" << r.policy << "\","
       << "\"rank\":" << r.rank << ","
       << "\"metrics\":" << r.metrics.to_json() << ","
       << "\"deltas\":[";
    for (std::size_t d = 0; d < r.deltas.size(); ++d) {
      if (d > 0) ss << ",";
      const auto& delta = r.deltas[d];
      ss << "{"
         << "\"metric\":\"" << delta.metric_name << "\","
         << "\"baseline\":" << delta.baseline_value << ","
         << "\"value\":" << delta.policy_value << ","
         << "\"delta\":" << delta.absolute_delta << ","
         << "\"percentChange\":" << delta.percent_change << ","
         << "\"isImprovement\":" << (delta.is_improvement ? "true" : "false")
         << "}";
    }
    ss << "],"
       << "\"badges\":[";
    for (std::size_t b = 0; b < r.badges.size(); ++b) {
      if (b > 0) ss << ",";
      ss << "\"" << r.badges[b] << "\"";
    }
    ss << "]}";
  }
  ss << "]}";
  return ss.str();
}

std::string MemoryComparisonReport::to_table() const {
  std::ostringstream ss;
  ss << "=========================================================================================\n"
     << " KernelLens Memory Multi-Policy Comparative Analysis (Baseline: " << baseline_policy << ")\n"
     << " Frames: " << num_frames << " | Reference String Length: " << reference_string.size() << "\n"
     << "=========================================================================================\n"
     << std::left << std::setw(6) << "Rank"
     << std::setw(14) << "Policy"
     << std::setw(14) << "Page Faults"
     << std::setw(14) << "Delta Faults"
     << std::setw(14) << "Fault Rate"
     << std::setw(14) << "TLB Hit Rate"
     << "Badges\n"
     << "-----------------------------------------------------------------------------------------\n";

  for (const auto& r : results) {
    double d_faults = 0.0;
    for (const auto& d : r.deltas) {
      if (d.metric_name == "pageFaults") d_faults = d.absolute_delta;
    }
    std::ostringstream d_ss;
    d_ss << (d_faults >= 0 ? "+" : "") << static_cast<int64_t>(d_faults);

    std::string badge_str;
    for (std::size_t b = 0; b < r.badges.size(); ++b) {
      if (b > 0) badge_str += ", ";
      badge_str += "[" + r.badges[b] + "]";
    }

    ss << std::left << std::setw(6) << r.rank
       << std::setw(14) << r.policy
       << std::setw(14) << r.metrics.page_faults
       << std::setw(14) << d_ss.str()
       << std::setw(14) << (std::to_string(static_cast<int>(r.metrics.fault_rate * 100)) + " %")
       << std::setw(14) << (std::to_string(static_cast<int>(r.metrics.tlb_hit_rate * 100)) + " %")
       << badge_str << "\n";
  }
  ss << "=========================================================================================\n";
  return ss.str();
}

std::string MemoryComparisonReport::to_csv() const {
  std::ostringstream ss;
  ss << "rank,policy,page_faults,delta_faults,fault_rate,tlb_hit_rate,badges\n";
  for (const auto& r : results) {
    double d_faults = 0.0;
    for (const auto& d : r.deltas) {
      if (d.metric_name == "pageFaults") d_faults = d.absolute_delta;
    }
    std::string badge_str;
    for (std::size_t b = 0; b < r.badges.size(); ++b) {
      if (b > 0) badge_str += ";";
      badge_str += r.badges[b];
    }
    ss << r.rank << ","
       << r.policy << ","
       << r.metrics.page_faults << ","
       << d_faults << ","
       << r.metrics.fault_rate << ","
       << r.metrics.tlb_hit_rate << ",\""
       << badge_str << "\"\n";
  }
  return ss.str();
}

// ----------------------------------------------------------------------------
// Allocator Comparison Implementation (Phase 9)
// ----------------------------------------------------------------------------

static std::unique_ptr<IMemoryAllocator> create_allocator(const std::string& name, std::size_t capacity) {
  if (name == "BEST_FIT") return std::make_unique<ContiguousAllocator>(capacity, AllocationPolicy::BestFit);
  if (name == "WORST_FIT") return std::make_unique<ContiguousAllocator>(capacity, AllocationPolicy::WorstFit);
  if (name == "BUDDY") return std::make_unique<BuddyAllocator>(capacity);
  return std::make_unique<ContiguousAllocator>(capacity, AllocationPolicy::FirstFit);
}

AllocatorComparisonReport ComparisonEngine::compare_allocator(
    std::size_t capacity,
    const std::vector<AllocatorOp>& operations,
    const std::vector<std::string>& policies,
    const std::string& baseline) {

  AllocatorComparisonReport report;
  report.baseline_policy = baseline;
  report.capacity = capacity;
  report.operations = operations;

  std::optional<AllocatorPolicyComparison> baseline_run;

  for (const auto& pol_name : policies) {
    auto alloc = create_allocator(pol_name, capacity);
    AllocatorPolicyComparison item;
    item.policy = pol_name;

    for (const auto& op : operations) {
      if (op.kind == AllocatorOpKind::Allocate) {
        auto res = alloc->allocate(op.owner, op.bytes);
        if (res.success) {
          item.successful_allocations++;
          item.total_allocated_bytes += res.allocated;
        } else {
          item.failed_allocations++;
        }
      } else {
        alloc->deallocate(op.owner);
      }
    }

    item.final_metrics = alloc->compute_metrics();

    if (pol_name == baseline) {
      baseline_run = item;
    }

    report.results.push_back(std::move(item));
  }

  if (!baseline_run.has_value()) {
    auto b_alloc = create_allocator(baseline, capacity);
    AllocatorPolicyComparison b_item;
    b_item.policy = baseline;
    for (const auto& op : operations) {
      if (op.kind == AllocatorOpKind::Allocate) {
        auto res = b_alloc->allocate(op.owner, op.bytes);
        if (res.success) {
          b_item.successful_allocations++;
          b_item.total_allocated_bytes += res.allocated;
        } else {
          b_item.failed_allocations++;
        }
      } else {
        b_alloc->deallocate(op.owner);
      }
    }
    b_item.final_metrics = b_alloc->compute_metrics();
    baseline_run = b_item;
  }

  const auto& br = *baseline_run;

  for (auto& r : report.results) {
    r.deltas.push_back(compute_delta("failedAllocations", static_cast<double>(br.failed_allocations), static_cast<double>(r.failed_allocations), true));
    r.deltas.push_back(compute_delta("internalFrag", static_cast<double>(br.final_metrics.internal_fragmentation), static_cast<double>(r.final_metrics.internal_fragmentation), true));
    r.deltas.push_back(compute_delta("externalFrag", static_cast<double>(br.final_metrics.external_fragmentation), static_cast<double>(r.final_metrics.external_fragmentation), true));
    r.deltas.push_back(compute_delta("utilization", br.final_metrics.memory_utilization, r.final_metrics.memory_utilization, false));
  }

  if (!report.results.empty()) {
    std::size_t min_failures = report.results[0].failed_allocations;
    std::size_t min_internal = report.results[0].final_metrics.internal_fragmentation;
    std::size_t min_external = report.results[0].final_metrics.external_fragmentation;
    double max_util = report.results[0].final_metrics.memory_utilization;

    for (const auto& r : report.results) {
      if (r.failed_allocations < min_failures) min_failures = r.failed_allocations;
      if (r.final_metrics.internal_fragmentation < min_internal) min_internal = r.final_metrics.internal_fragmentation;
      if (r.final_metrics.external_fragmentation < min_external) min_external = r.final_metrics.external_fragmentation;
      if (r.final_metrics.memory_utilization > max_util) max_util = r.final_metrics.memory_utilization;
    }

    for (auto& r : report.results) {
      if (r.failed_allocations == min_failures) r.badges.push_back("Lowest Failures");
      if (r.final_metrics.internal_fragmentation == min_internal) r.badges.push_back("Lowest Internal Frag");
      if (r.final_metrics.external_fragmentation == min_external) r.badges.push_back("Lowest External Frag");
      if (std::abs(r.final_metrics.memory_utilization - max_util) < 1e-4) r.badges.push_back("Highest Utilization");
    }

    std::vector<std::size_t> indices(report.results.size());
    for (std::size_t i = 0; i < indices.size(); ++i) indices[i] = i;
    std::sort(indices.begin(), indices.end(), [&](std::size_t a, std::size_t b) {
      if (report.results[a].failed_allocations != report.results[b].failed_allocations) {
        return report.results[a].failed_allocations < report.results[b].failed_allocations;
      }
      auto frag_a = report.results[a].final_metrics.internal_fragmentation + report.results[a].final_metrics.external_fragmentation;
      auto frag_b = report.results[b].final_metrics.internal_fragmentation + report.results[b].final_metrics.external_fragmentation;
      return frag_a < frag_b;
    });
    for (std::size_t rank = 0; rank < indices.size(); ++rank) {
      report.results[indices[rank]].rank = static_cast<int>(rank + 1);
    }
  }

  return report;
}

std::string AllocatorComparisonReport::to_json() const {
  std::ostringstream ss;
  ss << std::fixed << std::setprecision(4);
  ss << "{"
     << "\"schemaVersion\":1,"
     << "\"subsystem\":\"allocator\","
     << "\"baselinePolicy\":\"" << baseline_policy << "\","
     << "\"capacity\":" << capacity << ","
     << "\"operationsCount\":" << operations.size() << ","
     << "\"results\":[";

  for (std::size_t i = 0; i < results.size(); ++i) {
    if (i > 0) ss << ",";
    const auto& r = results[i];
    ss << "{"
       << "\"policy\":\"" << r.policy << "\","
       << "\"rank\":" << r.rank << ","
       << "\"successfulAllocations\":" << r.successful_allocations << ","
       << "\"failedAllocations\":" << r.failed_allocations << ","
       << "\"totalAllocatedBytes\":" << r.total_allocated_bytes << ","
       << "\"finalMetrics\":" << r.final_metrics.to_json() << ","
       << "\"deltas\":[";
    for (std::size_t d = 0; d < r.deltas.size(); ++d) {
      if (d > 0) ss << ",";
      const auto& delta = r.deltas[d];
      ss << "{"
         << "\"metric\":\"" << delta.metric_name << "\","
         << "\"baseline\":" << delta.baseline_value << ","
         << "\"value\":" << delta.policy_value << ","
         << "\"delta\":" << delta.absolute_delta << ","
         << "\"percentChange\":" << delta.percent_change << ","
         << "\"isImprovement\":" << (delta.is_improvement ? "true" : "false")
         << "}";
    }
    ss << "],"
       << "\"badges\":[";
    for (std::size_t b = 0; b < r.badges.size(); ++b) {
      if (b > 0) ss << ",";
      ss << "\"" << r.badges[b] << "\"";
    }
    ss << "]}";
  }
  ss << "]}";
  return ss.str();
}

std::string AllocatorComparisonReport::to_table() const {
  std::ostringstream ss;
  ss << "========================================================================================================================\n"
     << " KernelLens Memory Allocator Comparative Analysis (Baseline: " << baseline_policy << ")\n"
     << " Capacity: " << capacity << " bytes | Operations: " << operations.size() << "\n"
     << "========================================================================================================================\n"
     << std::left << std::setw(6) << "Rank"
     << std::setw(14) << "Policy"
     << std::setw(10) << "Success"
     << std::setw(10) << "Failed"
     << std::setw(16) << "Internal Frag"
     << std::setw(16) << "External Frag"
     << std::setw(14) << "Utilization"
     << "Badges\n"
     << "------------------------------------------------------------------------------------------------------------------------\n";

  for (const auto& r : results) {
    std::string badge_str;
    for (std::size_t b = 0; b < r.badges.size(); ++b) {
      if (b > 0) badge_str += ", ";
      badge_str += "[" + r.badges[b] + "]";
    }

    ss << std::left << std::setw(6) << r.rank
       << std::setw(14) << r.policy
       << std::setw(10) << r.successful_allocations
       << std::setw(10) << r.failed_allocations
       << std::setw(16) << r.final_metrics.internal_fragmentation
       << std::setw(16) << r.final_metrics.external_fragmentation
       << std::setw(14) << (std::to_string(static_cast<int>(r.final_metrics.memory_utilization * 100)) + " %")
       << badge_str << "\n";
  }
  ss << "========================================================================================================================\n";
  return ss.str();
}

std::string AllocatorComparisonReport::to_csv() const {
  std::ostringstream ss;
  ss << "rank,policy,successful_allocations,failed_allocations,internal_frag,external_frag,utilization,badges\n";
  for (const auto& r : results) {
    std::string badge_str;
    for (std::size_t b = 0; b < r.badges.size(); ++b) {
      if (b > 0) badge_str += ";";
      badge_str += r.badges[b];
    }
    ss << r.rank << ","
       << r.policy << ","
       << r.successful_allocations << ","
       << r.failed_allocations << ","
       << r.final_metrics.internal_fragmentation << ","
       << r.final_metrics.external_fragmentation << ","
       << r.final_metrics.memory_utilization << ",\""
       << badge_str << "\"\n";
  }
  return ss.str();
}

} // namespace kernellens
