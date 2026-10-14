#include "kernellens/core/metrics.hpp"
#include <numeric>
#include <sstream>
#include <iomanip>

namespace kernellens {

SimulationMetrics MetricsCalculator::compute(const std::vector<ProcessRuntime>& processes,
                                             Tick total_elapsed_ticks,
                                             std::size_t context_switches,
                                             Tick switch_overhead_ticks) {
  (void)switch_overhead_ticks;
  SimulationMetrics metrics;
  metrics.context_switches = context_switches;

  if (processes.empty()) {
    return metrics;
  }

  double total_wait = 0.0;
  double total_turnaround = 0.0;
  double total_response = 0.0;
  Tick total_cpu_service = 0;
  std::size_t completed_count = 0;

  std::vector<double> cpu_allocations;

  for (const auto& pr : processes) {
    ProcessMetrics pm;
    pm.pid = pr.spec.pid;
    pm.waiting_time = pr.ready_wait;
    pm.cpu_service = pr.cpu_service;

    if (pr.first_run_time >= 0) {
      pm.response_time = pr.first_run_time - pr.spec.arrival_time;
    } else {
      pm.response_time = 0;
    }

    if (pr.finish_time >= 0) {
      pm.turnaround_time = pr.finish_time - pr.spec.arrival_time;
      completed_count++;
    } else {
      pm.turnaround_time = total_elapsed_ticks - pr.spec.arrival_time;
    }

    total_wait += static_cast<double>(pm.waiting_time);
    total_turnaround += static_cast<double>(pm.turnaround_time);
    total_response += static_cast<double>(pm.response_time);
    total_cpu_service += pm.cpu_service;

    cpu_allocations.push_back(static_cast<double>(pm.cpu_service));
    metrics.per_process.push_back(pm);
  }

  const double n = static_cast<double>(processes.size());
  metrics.averages.waiting_time = total_wait / n;
  metrics.averages.turnaround_time = total_turnaround / n;
  metrics.averages.response_time = total_response / n;

  if (total_elapsed_ticks > 0) {
    metrics.throughput = static_cast<double>(completed_count) / static_cast<double>(total_elapsed_ticks);
    metrics.cpu_utilization = static_cast<double>(total_cpu_service) / static_cast<double>(total_elapsed_ticks);
    if (metrics.cpu_utilization > 1.0) {
      metrics.cpu_utilization = 1.0;
    }
  }

  // Jain's Fairness Index: (sum x_i)^2 / (n * sum x_i^2)
  if (cpu_allocations.size() >= 2) {
    double sum = 0.0;
    double sum_sq = 0.0;
    for (double x : cpu_allocations) {
      sum += x;
      sum_sq += (x * x);
    }
    if (sum_sq > 0.0) {
      metrics.jain_fairness = (sum * sum) / (static_cast<double>(cpu_allocations.size()) * sum_sq);
    } else {
      metrics.jain_fairness = 1.0;
    }
  } else if (!cpu_allocations.empty()) {
    metrics.jain_fairness = 1.0;
  }

  return metrics;
}

std::string SimulationMetrics::to_json() const {
  std::ostringstream ss;
  ss << std::fixed << std::setprecision(4);
  ss << "{"
     << "\"perProcess\":[";
  for (std::size_t i = 0; i < per_process.size(); ++i) {
    if (i > 0) ss << ",";
    ss << "{\"pid\":" << per_process[i].pid
       << ",\"waitingTime\":" << per_process[i].waiting_time
       << ",\"turnaroundTime\":" << per_process[i].turnaround_time
       << ",\"responseTime\":" << per_process[i].response_time
       << ",\"cpuService\":" << per_process[i].cpu_service << "}";
  }
  ss << "],"
     << "\"averages\":{"
     << "\"waitingTime\":" << averages.waiting_time << ","
     << "\"turnaroundTime\":" << averages.turnaround_time << ","
     << "\"responseTime\":" << averages.response_time
     << "},"
     << "\"throughput\":" << throughput << ","
     << "\"cpuUtilization\":" << cpu_utilization << ","
     << "\"contextSwitches\":" << context_switches << ",";
  if (jain_fairness.has_value()) {
    ss << "\"jainFairness\":" << *jain_fairness;
  } else {
    ss << "\"jainFairness\":null";
  }
  ss << "}";
  return ss.str();
}

} // namespace kernellens
