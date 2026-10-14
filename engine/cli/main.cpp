#include "kernellens/core/engine.hpp"
#include "kernellens/cpu/fcfs.hpp"
#include "kernellens/cpu/sjf.hpp"
#include "kernellens/cpu/srtf.hpp"
#include "kernellens/cpu/priority.hpp"
#include "kernellens/cpu/round_robin.hpp"
#include "kernellens/cpu/mlfq.hpp"
#include "kernellens/cpu/cfs_like.hpp"
#include "kernellens/workload/presets.hpp"
#include <iostream>
#include <string>
#include <memory>
#include <iomanip>

#include "kernellens/memory/replacers.hpp"
#include "kernellens/memory/paging_system.hpp"
#include "kernellens/sync/banker.hpp"
#include "kernellens/sync/resource_graph.hpp"

using namespace kernellens;

void print_help() {
  std::cout << "KernelLens — OS-in-a-Box Deterministic Simulation Engine\n"
            << "Usage: kernellens [options]\n\n"
            << "Options:\n"
            << "  --module <cpu|memory|sync|disk>   Simulation subsystem (default: cpu)\n"
            << "  --policy <NAME>                   Policy: FCFS, SJF, SRTF, PRIORITY, ROUND_ROBIN, MLFQ, CFS_LIKE\n"
            << "  --preset <NAME>                   Workload preset: convoy, sjf, starvation, interactive, rr, mlfq\n"
            << "  --quantum <TICKS>                 Time slice for RoundRobin / MLFQ (default: 3)\n"
            << "  --preemptive                      Enable preemption for Priority scheduler\n"
            << "  --aging <TICKS>                   Aging tick interval for Priority scheduler (0 = off)\n"
            << "  --format <json|ndjson|summary>    Output format (default: summary)\n"
            << "  --help                            Display this help message\n";
}

int main(int argc, char* argv[]) {
  std::string module = "cpu";
  std::string policy_str = "ROUND_ROBIN";
  std::string preset_str = "convoy";
  std::string format = "summary";
  Tick quantum = 3;
  Tick aging = 0;
  bool preemptive = false;

  for (int i = 1; i < argc; ++i) {
    std::string arg = argv[i];
    if (arg == "--help" || arg == "-h") {
      print_help();
      return 0;
    } else if (arg == "--module" && i + 1 < argc) {
      module = argv[++i];
    } else if (arg == "--policy" && i + 1 < argc) {
      policy_str = argv[++i];
    } else if (arg == "--preset" && i + 1 < argc) {
      preset_str = argv[++i];
    } else if (arg == "--format" && i + 1 < argc) {
      format = argv[++i];
    } else if (arg == "--quantum" && i + 1 < argc) {
      quantum = std::stoll(argv[++i]);
    } else if (arg == "--aging" && i + 1 < argc) {
      aging = std::stoll(argv[++i]);
    } else if (arg == "--preemptive") {
      preemptive = true;
    }
  }

  if (module == "memory") {
    std::unique_ptr<IPageReplacer> replacer;
    if (policy_str == "FIFO") {
      replacer = std::make_unique<FifoReplacer>();
    } else if (policy_str == "LRU") {
      replacer = std::make_unique<LruReplacer>();
    } else if (policy_str == "OPTIMAL") {
      replacer = std::make_unique<OptimalReplacer>();
    } else if (policy_str == "CLOCK") {
      replacer = std::make_unique<ClockReplacer>();
    } else {
      replacer = std::make_unique<FifoReplacer>();
    }

    std::vector<std::uint32_t> refs;
    if (preset_str == "belady") {
      refs = {1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5};
    } else {
      refs = {7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2, 1, 2, 0, 1, 7, 0, 1};
    }

    std::size_t num_frames = static_cast<std::size_t>(quantum); // Use quantum arg for frame count
    if (num_frames == 0) num_frames = 3;

    EventLog log("mem-" + policy_str);
    PagingSystem paging(num_frames, std::move(replacer), 4, &log);

    for (std::size_t i = 0; i < refs.size(); ++i) {
      paging.access(static_cast<Tick>(i), refs[i], i, refs);
    }

    const auto& m = paging.metrics();
    if (format == "json") {
      std::cout << "{\"events\":" << log.to_json()
                << ",\"metrics\":" << m.to_json() << "}\n";
    } else {
      std::cout << "========================================================\n"
                << " KernelLens Memory Simulation: " << policy_str << " (" << num_frames << " frames)\n"
                << "========================================================\n"
                << " Total Accesses:     " << m.total_accesses << "\n"
                << " Page Faults:        " << m.page_faults << "\n"
                << " Fault Rate:         " << std::fixed << std::setprecision(2) << (m.fault_rate * 100.0) << " %\n"
                << " TLB Hits:           " << m.tlb_hits << "\n"
                << " TLB Misses:         " << m.tlb_misses << "\n"
                << " TLB Hit Rate:       " << std::fixed << std::setprecision(2) << (m.tlb_hit_rate * 100.0) << " %\n"
                << "========================================================\n";
    }
    return 0;
  }

  if (module == "sync") {
    if (policy_str == "BANKER") {
      EventLog log("sync-banker");
      BankersAlgorithm banker(5, 3, &log);
      banker.set_available({3, 3, 2});
      banker.set_allocation(0, {0, 1, 0});
      banker.set_allocation(1, {2, 0, 0});
      banker.set_allocation(2, {3, 0, 2});
      banker.set_allocation(3, {2, 1, 1});
      banker.set_allocation(4, {0, 0, 2});
      banker.set_maximum(0, {7, 5, 3});
      banker.set_maximum(1, {3, 2, 2});
      banker.set_maximum(2, {9, 0, 2});
      banker.set_maximum(3, {2, 2, 2});
      banker.set_maximum(4, {4, 3, 3});

      auto safety = banker.check_safety();
      auto req = banker.request_resources(1, {1, 0, 2}, 5);

      if (format == "json") {
        std::cout << "{\"events\":" << log.to_json()
                  << ",\"safety\":" << safety.to_json()
                  << ",\"request\":" << req.to_json() << "}\n";
      } else {
        std::cout << "========================================================\n"
                  << " KernelLens Banker's Algorithm Simulation\n"
                  << "========================================================\n"
                  << " " << safety.explanation << "\n"
                  << " Evaluating Request from P1: [1, 0, 2]\n"
                  << " Decision: " << (req.granted ? "GRANTED" : "DENIED") << "\n"
                  << " Details:  " << req.reason << "\n"
                  << "========================================================\n";
      }
      return 0;
    } else {
      // RAG Deadlock Cycle Detection demo
      EventLog log("sync-rag");
      ResourceAllocationGraph rag(&log);
      rag.add_request_edge("P1", "R1", 1);
      rag.add_assignment_edge("R1", "P2", 2);
      rag.add_request_edge("P2", "R2", 3);
      rag.add_assignment_edge("R2", "P1", 4);

      auto report = rag.detect_deadlock(5);
      if (format == "json") {
        std::cout << "{\"events\":" << log.to_json()
                  << ",\"report\":" << report.to_json() << "}\n";
      } else {
        std::cout << "========================================================\n"
                  << " KernelLens Resource Allocation Graph (RAG) Analysis\n"
                  << "========================================================\n"
                  << " Deadlock Detected: " << (report.has_deadlock ? "YES" : "NO") << "\n"
                  << " Detected Cycles:   " << report.cycles.size() << "\n";
        for (const auto& c : report.cycles) {
          std::cout << "  Cycle: ";
          for (std::size_t i = 0; i < c.size(); ++i) {
            if (i > 0) std::cout << " -> ";
            std::cout << c[i];
          }
          std::cout << "\n";
        }
        std::cout << "========================================================\n";
      }
      return 0;
    }
  }

  std::unique_ptr<IScheduler> scheduler;
  if (policy_str == "FCFS") {
    scheduler = std::make_unique<FcfsScheduler>();
  } else if (policy_str == "SJF") {
    scheduler = std::make_unique<SjfScheduler>();
  } else if (policy_str == "SRTF") {
    scheduler = std::make_unique<SrtfScheduler>();
  } else if (policy_str == "PRIORITY") {
    scheduler = std::make_unique<PriorityScheduler>(preemptive, aging);
  } else if (policy_str == "ROUND_ROBIN") {
    scheduler = std::make_unique<RoundRobinScheduler>(quantum);
  } else if (policy_str == "MLFQ") {
    scheduler = std::make_unique<MlfqScheduler>(std::vector<Tick>{quantum, quantum * 2, quantum * 4});
  } else if (policy_str == "CFS_LIKE") {
    scheduler = std::make_unique<CfsLikeScheduler>(quantum * 2);
  } else {
    std::cerr << "Unknown policy: " << policy_str << "\n";
    return 1;
  }

  std::vector<ProcessSpec> workload;
  if (preset_str == "convoy") {
    workload = WorkloadPresets::convoy_effect();
  } else if (preset_str == "sjf") {
    workload = WorkloadPresets::sjf_benchmark();
  } else if (preset_str == "starvation") {
    workload = WorkloadPresets::starvation_scenario();
  } else if (preset_str == "interactive") {
    workload = WorkloadPresets::interactive_mixed();
  } else if (preset_str == "rr") {
    workload = WorkloadPresets::round_robin_demo();
  } else if (preset_str == "mlfq") {
    workload = WorkloadPresets::mlfq_demo();
  } else {
    workload = WorkloadPresets::convoy_effect();
  }

  SimulationConfig config;
  config.run_id = preset_str + "-" + policy_str;
  SimulationEngine engine(config);
  engine.set_scheduler(std::move(scheduler));
  engine.load_workload(workload);

  engine.run();

  const auto& metrics = engine.metrics();
  if (format == "json") {
    std::cout << "{\"events\":" << engine.event_log().to_json()
              << ",\"metrics\":" << metrics.to_json() << "}\n";
  } else if (format == "ndjson") {
    std::cout << engine.event_log().to_ndjson();
  } else {
    std::cout << "========================================================\n"
              << " KernelLens Simulation Result: " << policy_str << " (" << preset_str << ")\n"
              << "========================================================\n"
              << " Simulated Duration:  " << engine.current_tick() << " ticks\n"
              << " Total Events:       " << engine.event_log().size() << "\n"
              << " Context Switches:   " << metrics.context_switches << "\n"
              << " CPU Utilization:    " << std::fixed << std::setprecision(2) << (metrics.cpu_utilization * 100.0) << " %\n"
              << " Throughput:         " << std::fixed << std::setprecision(4) << metrics.throughput << " proc/tick\n";
    if (metrics.jain_fairness.has_value()) {
      std::cout << " Jain Fairness:      " << std::fixed << std::setprecision(4) << *metrics.jain_fairness << "\n";
    }
    std::cout << "--------------------------------------------------------\n"
              << " Process Details:\n";
    for (const auto& pm : metrics.per_process) {
      std::cout << "  PID " << pm.pid
                << " | Wait: " << std::setw(3) << pm.waiting_time
                << " | Turnaround: " << std::setw(3) << pm.turnaround_time
                << " | Response: " << std::setw(3) << pm.response_time
                << " | CPU: " << std::setw(3) << pm.cpu_service << "\n";
    }
    std::cout << "--------------------------------------------------------\n"
              << " Averages: Wait=" << std::fixed << std::setprecision(2) << metrics.averages.waiting_time
              << " | Turnaround=" << metrics.averages.turnaround_time
              << " | Response=" << metrics.averages.response_time << "\n"
              << "========================================================\n";
  }

  return 0;
}
