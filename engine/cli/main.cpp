#include "kernellens/core/engine.hpp"
#include "kernellens/core/comparator.hpp"
#include "kernellens/core/replay_engine.hpp"
#include "kernellens/cpu/fcfs.hpp"
#include "kernellens/cpu/sjf.hpp"
#include "kernellens/cpu/srtf.hpp"
#include "kernellens/cpu/priority.hpp"
#include "kernellens/cpu/round_robin.hpp"
#include "kernellens/cpu/mlfq.hpp"
#include "kernellens/cpu/cfs_like.hpp"
#include "kernellens/workload/presets.hpp"
#include "kernellens/workload/generator.hpp"
#include "kernellens/memory/replacers.hpp"
#include "kernellens/memory/paging_system.hpp"
#include "kernellens/memory/allocator.hpp"
#include "kernellens/sync/banker.hpp"
#include "kernellens/sync/resource_graph.hpp"
#include "kernellens/disk/schedulers.hpp"
#include "kernellens/filesystem/filesystem.hpp"
#include "kernellens/filesystem/journal.hpp"
#include "kernellens/ipc/pipe.hpp"
#include "kernellens/ipc/message_queue.hpp"
#include "kernellens/ipc/shared_memory.hpp"
#include "kernellens/ipc/ipc_manager.hpp"
#include "kernellens/syscall/syscall_table.hpp"
#include "kernellens/interrupt/interrupt.hpp"

#include <iostream>
#include <string>
#include <memory>
#include <iomanip>
#include <sstream>
#include <vector>

using namespace kernellens;

static std::vector<std::string> split_csv(const std::string& str) {
  std::vector<std::string> tokens;
  std::stringstream ss(str);
  std::string item;
  while (std::getline(ss, item, ',')) {
    // trim
    auto s = item.find_first_not_of(" \t");
    auto e = item.find_last_not_of(" \t");
    if (s != std::string::npos && e != std::string::npos) {
      tokens.push_back(item.substr(s, e - s + 1));
    }
  }
  return tokens;
}

void print_help() {
  std::cout << "KernelLens — OS-in-a-Box Deterministic Simulation Engine\n"
            << "Usage: kernellens [options]\n\n"
            << "Execution Modes:\n"
            << "  --module <cpu|memory|sync|disk|allocator|filesystem|ipc|syscall|interrupt> Simulation subsystem (default: cpu)\n"
            << "  --policy <NAME>                   Policy name (e.g. FCFS, SJF, SRTF, ROUND_ROBIN, LRU, SSTF, FIRST_FIT, BEST_FIT, WORST_FIT, BUDDY)\n"
            << "  --preset <NAME>                   Workload preset: convoy, sjf, starvation, interactive, rr, mlfq, belady\n"
            << "  --workload-file <PATH>            Path to JSON workload file\n\n"
            << "Phase 8 & 9 Extensions:\n"
            << "  --compare                         Run multi-policy comparative evaluation\n"
            << "  --policies <P1,P2,...>            Comma-separated list of policies to compare\n"
            << "  --baseline <NAME>                 Baseline policy for delta calculations (default: FCFS, FIFO, or FIRST_FIT)\n"
            << "  --capacity <BYTES>                Total memory capacity for allocator (default: 1024)\n"
            << "  --compact                         Perform memory compaction after allocator workload\n"
            << "  --generate                        Generate deterministic synthetic workload\n"
            << "  --seed <UINT64>                   PRNG seed for reproducibility (default: 42)\n"
            << "  --dist <uniform|exp|bimodal|norm> Burst distribution profile (default: uniform)\n"
            << "  --processes <N>                   Number of processes to generate (default: 5)\n"
            << "  --export-workload <PATH>          Save generated workload to JSON file\n"
            << "  --replay                          Run simulation with periodic checkpoint capture (K=50)\n"
            << "  --scrub <T1,T2,...>               Time-travel scrub to comma-separated ticks and print state\n"
            << "  --checkpoint-interval <K>         Snapshot frequency in events (default: 50)\n\n"
            << "Phase 10 & 11 Extensions:\n"
            << "  --fs-strategy <CONTIGUOUS|LINKED|INDEXED> File allocation strategy (default: INDEXED)\n"
            << "  --fs-capacity <BLOCKS>            Total block capacity for filesystem (default: 128)\n"
            << "  --ipc-capacity <BYTES>            Pipe circular buffer capacity (default: 512)\n"
            << "  --mq-capacity <MSGS>              Message queue capacity (default: 10)\n\n"
            << "Common Options:\n"
            << "  --quantum <TICKS>                 Time slice for RoundRobin / MLFQ (default: 3)\n"
            << "  --preemptive                      Enable preemption for Priority scheduler\n"
            << "  --aging <TICKS>                   Aging tick interval for Priority scheduler (0 = off)\n"
            << "  --format <summary|table|json|csv> Output presentation format (default: summary/table)\n"
            << "  --version, -v                     Display version information\n"
            << "  --help, -h                        Display this help message\n";
}

int main(int argc, char* argv[]) {
  std::string module = "cpu";
  std::string policy_str = "ROUND_ROBIN";
  std::string preset_str = "convoy";
  std::string format = "summary";
  std::string workload_file = "";
  std::string export_workload_file = "";
  std::string baseline_str = "";
  std::string policies_arg = "";
  std::string scrub_arg = "";
  std::string dist_str = "uniform";
  std::string fs_strategy_str = "INDEXED";

  Tick quantum = 3;
  Tick aging = 0;
  bool preemptive = false;
  bool compare_mode = false;
  bool generate_mode = false;
  bool replay_mode = false;
  bool do_compact = false;
  std::size_t capacity = 1024;
  std::size_t fs_blocks = 128;
  std::size_t ipc_capacity = 512;
  std::size_t mq_capacity = 10;
  std::uint64_t seed = 42;
  std::size_t num_processes = 5;
  std::size_t checkpoint_interval = 50;

  for (int i = 1; i < argc; ++i) {
    std::string arg = argv[i];
    if (arg == "--help" || arg == "-h") {
      print_help();
      return 0;
    } else if (arg == "--version" || arg == "-v") {
      std::cout << "KernelLens version 1.0.0 (Phase 11: Deterministic OS Simulation Engine)\n";
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
    } else if (arg == "--capacity" && i + 1 < argc) {
      capacity = std::stoull(argv[++i]);
    } else if (arg == "--compact") {
      do_compact = true;
    } else if (arg == "--fs-strategy" && i + 1 < argc) {
      fs_strategy_str = argv[++i];
    } else if (arg == "--fs-capacity" && i + 1 < argc) {
      fs_blocks = std::stoull(argv[++i]);
    } else if (arg == "--ipc-capacity" && i + 1 < argc) {
      ipc_capacity = std::stoull(argv[++i]);
    } else if (arg == "--mq-capacity" && i + 1 < argc) {
      mq_capacity = std::stoull(argv[++i]);
    } else if (arg == "--preemptive") {
      preemptive = true;
    } else if (arg == "--compare") {
      compare_mode = true;
    } else if (arg == "--generate") {
      generate_mode = true;
    } else if (arg == "--replay") {
      replay_mode = true;
    } else if (arg == "--seed" && i + 1 < argc) {
      seed = std::stoull(argv[++i]);
    } else if (arg == "--processes" && i + 1 < argc) {
      num_processes = std::stoul(argv[++i]);
    } else if (arg == "--dist" && i + 1 < argc) {
      dist_str = argv[++i];
    } else if (arg == "--workload-file" && i + 1 < argc) {
      workload_file = argv[++i];
    } else if (arg == "--export-workload" && i + 1 < argc) {
      export_workload_file = argv[++i];
    } else if (arg == "--baseline" && i + 1 < argc) {
      baseline_str = argv[++i];
    } else if (arg == "--policies" && i + 1 < argc) {
      policies_arg = argv[++i];
    } else if (arg == "--scrub" && i + 1 < argc) {
      scrub_arg = argv[++i];
    } else if (arg == "--checkpoint-interval" && i + 1 < argc) {
      checkpoint_interval = std::stoul(argv[++i]);
    }
  }

  // -------------------------------------------------------------
  // Workload Generation Mode
  // -------------------------------------------------------------
  if (generate_mode) {
    WorkloadGeneratorConfig g_cfg;
    g_cfg.seed = seed;
    g_cfg.num_processes = num_processes;
    if (dist_str == "exp" || dist_str == "exponential") {
      g_cfg.burst_distribution = DistributionType::Exponential;
    } else if (dist_str == "bimodal") {
      g_cfg.burst_distribution = DistributionType::Bimodal;
    } else if (dist_str == "norm" || dist_str == "normal") {
      g_cfg.burst_distribution = DistributionType::Normal;
    } else {
      g_cfg.burst_distribution = DistributionType::Uniform;
    }

    WorkloadGenerator gen(g_cfg);
    auto specs = gen.generate();

    if (!export_workload_file.empty()) {
      if (WorkloadGenerator::save_to_file(export_workload_file, specs, "generated-workload")) {
        std::cout << "[✓] Generated workload (" << specs.size() << " processes) saved to: "
                  << export_workload_file << "\n";
      } else {
        std::cerr << "[✗] Error writing workload to file: " << export_workload_file << "\n";
        return 1;
      }
    } else {
      std::cout << WorkloadGenerator::to_json(specs, "generated-workload") << "\n";
    }
    return 0;
  }

  // -------------------------------------------------------------
  // Algorithm Comparison Mode (Phase 8 Pillar 2)
  // -------------------------------------------------------------
  if (compare_mode) {
    if (module == "disk") {
      std::vector<std::string> pols;
      if (!policies_arg.empty()) {
        pols = split_csv(policies_arg);
      } else {
        pols = {"FCFS", "SSTF", "SCAN", "C-SCAN", "LOOK", "C-LOOK"};
      }
      std::string base = baseline_str.empty() ? "FCFS" : baseline_str;
      std::vector<std::uint32_t> requests = {98, 183, 37, 122, 14, 124, 65, 67};
      auto report = ComparisonEngine::compare_disk(requests, 53, HeadDirection::Up, 199, pols, base);

      if (format == "json") {
        std::cout << report.to_json() << "\n";
      } else if (format == "csv") {
        std::cout << report.to_csv();
      } else {
        std::cout << report.to_table();
      }
      return 0;
    } else if (module == "memory") {
      std::vector<std::string> pols;
      if (!policies_arg.empty()) {
        pols = split_csv(policies_arg);
      } else {
        pols = {"FIFO", "LRU", "OPTIMAL", "CLOCK"};
      }
      std::string base = baseline_str.empty() ? "FIFO" : baseline_str;
      std::vector<std::uint32_t> refs;
      if (preset_str == "belady") {
        refs = {1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5};
      } else {
        refs = {7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2, 1, 2, 0, 1, 7, 0, 1};
      }
      std::size_t num_frames = static_cast<std::size_t>(quantum);
      if (num_frames == 0) num_frames = 3;

      auto report = ComparisonEngine::compare_memory(refs, num_frames, pols, base);
      if (format == "json") {
        std::cout << report.to_json() << "\n";
      } else if (format == "csv") {
        std::cout << report.to_csv();
      } else {
        std::cout << report.to_table();
      }
      return 0;
    } else if (module == "allocator") {
      std::vector<std::string> pols;
      if (!policies_arg.empty()) {
        pols = split_csv(policies_arg);
      } else {
        pols = {"FIRST_FIT", "BEST_FIT", "WORST_FIT", "BUDDY"};
      }
      std::string base = baseline_str.empty() ? "FIRST_FIT" : baseline_str;
      std::size_t cap = capacity > 0 ? capacity : 1024;

      std::vector<AllocatorOp> ops = {
        {AllocatorOpKind::Allocate, 1, 100, std::nullopt},
        {AllocatorOpKind::Allocate, 2, 240, std::nullopt},
        {AllocatorOpKind::Allocate, 3, 64,  std::nullopt},
        {AllocatorOpKind::Allocate, 4, 256, std::nullopt},
        {AllocatorOpKind::Deallocate, 2, 0, std::nullopt},
        {AllocatorOpKind::Allocate, 5, 120, std::nullopt},
        {AllocatorOpKind::Allocate, 6, 300, std::nullopt},
        {AllocatorOpKind::Deallocate, 1, 0, std::nullopt},
        {AllocatorOpKind::Deallocate, 3, 0, std::nullopt},
        {AllocatorOpKind::Allocate, 7, 200, std::nullopt}
      };

      auto report = ComparisonEngine::compare_allocator(cap, ops, pols, base);
      if (format == "json") {
        std::cout << report.to_json() << "\n";
      } else if (format == "csv") {
        std::cout << report.to_csv();
      } else {
        std::cout << report.to_table();
      }
      return 0;
    } else {
      // Default: CPU comparison
      std::vector<std::string> pols;
      if (!policies_arg.empty()) {
        pols = split_csv(policies_arg);
      } else {
        pols = {"FCFS", "SJF", "SRTF", "PRIORITY", "ROUND_ROBIN", "MLFQ", "CFS_LIKE"};
      }
      std::string base = baseline_str.empty() ? "FCFS" : baseline_str;

      std::vector<ProcessSpec> workload;
      if (!workload_file.empty()) {
        workload = WorkloadGenerator::load_from_file(workload_file);
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

      auto report = ComparisonEngine::compare_cpu(workload, pols, base, quantum, aging, 0);
      if (format == "json") {
        std::cout << report.to_json() << "\n";
      } else if (format == "csv") {
        std::cout << report.to_csv();
      } else {
        std::cout << report.to_table();
      }
      return 0;
    }
  }

  // -------------------------------------------------------------
  // Deterministic Checkpoint Replay Mode (Phase 8 Pillar 3)
  // -------------------------------------------------------------
  if (replay_mode) {
    std::vector<ProcessSpec> workload;
    if (!workload_file.empty()) {
      workload = WorkloadGenerator::load_from_file(workload_file);
    } else if (preset_str == "sjf") {
      workload = WorkloadPresets::sjf_benchmark();
    } else {
      workload = WorkloadPresets::convoy_effect();
    }

    SimulationConfig cfg;
    cfg.run_id = "replay-" + policy_str;
    SimulationEngine engine(cfg);

    if (policy_str == "SJF") engine.set_scheduler(std::make_unique<SjfScheduler>());
    else if (policy_str == "SRTF") engine.set_scheduler(std::make_unique<SrtfScheduler>());
    else if (policy_str == "PRIORITY") engine.set_scheduler(std::make_unique<PriorityScheduler>(preemptive, aging));
    else if (policy_str == "ROUND_ROBIN" || policy_str == "RR") engine.set_scheduler(std::make_unique<RoundRobinScheduler>(quantum));
    else engine.set_scheduler(std::make_unique<FcfsScheduler>());

    engine.load_workload(workload);

    ReplayConfig r_cfg;
    r_cfg.checkpoint_interval_events = checkpoint_interval;
    ReplayEngine replay(r_cfg);
    replay.record_session(engine);

    std::string err;
    bool ok = replay.verify_determinism(&err);

    if (!scrub_arg.empty()) {
      auto ticks = split_csv(scrub_arg);
      std::cout << "========================================================\n"
                << " KernelLens Time-Travel Scrubbing Report (K=" << checkpoint_interval << ")\n"
                << " Verification: " << (ok ? "VERIFIED (100% Deterministic)" : ("FAILED: " + err)) << "\n"
                << "========================================================\n";
      for (const auto& t_str : ticks) {
        Tick t = std::stoll(t_str);
        auto snap = replay.reconstruct_at_tick(t);
        auto nearest = replay.find_nearest_snapshot(t);
        std::cout << "--- Scrub to Tick: " << t << " ---\n"
                  << "  Nearest Checkpoint Tick: " << (nearest ? std::to_string(nearest->tick) : "None") << "\n"
                  << "  Reconstructed State:     " << snap.to_json() << "\n";
      }
      return 0;
    }

    if (format == "json") {
      std::cout << replay.to_json() << "\n";
    } else {
      std::cout << "========================================================\n"
                << " KernelLens Replay Session Summary\n"
                << "========================================================\n"
                << " Policy:               " << policy_str << "\n"
                << " Total Duration:       " << replay.max_tick() << " ticks\n"
                << " Checkpoints Captured: " << replay.snapshot_count() << " (interval: " << checkpoint_interval << " events)\n"
                << " Replay Determinism:   " << (ok ? "PASSED (Zero Reverse Mutations)" : ("FAILED: " + err)) << "\n"
                << "========================================================\n";
    }
    return 0;
  }

  // -------------------------------------------------------------
  // Memory Subsystem
  // -------------------------------------------------------------
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

    std::size_t num_frames = static_cast<std::size_t>(quantum);
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

  // -------------------------------------------------------------
  // Sync Subsystem
  // -------------------------------------------------------------
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

  // -------------------------------------------------------------
  // Disk Subsystem
  // -------------------------------------------------------------
  if (module == "disk") {
    std::unique_ptr<IDiskScheduler> disk_sched;
    if (policy_str == "SSTF") {
      disk_sched = std::make_unique<DiskSstfScheduler>();
    } else if (policy_str == "SCAN") {
      disk_sched = std::make_unique<DiskScanScheduler>();
    } else if (policy_str == "C-SCAN" || policy_str == "CSCAN") {
      disk_sched = std::make_unique<DiskCScanScheduler>();
    } else if (policy_str == "LOOK") {
      disk_sched = std::make_unique<DiskLookScheduler>();
    } else if (policy_str == "C-LOOK" || policy_str == "CLOOK") {
      disk_sched = std::make_unique<DiskCLookScheduler>();
    } else {
      disk_sched = std::make_unique<DiskFcfsScheduler>();
    }

    std::vector<std::uint32_t> requests = {98, 183, 37, 122, 14, 124, 65, 67};
    std::uint32_t initial_head = 53;
    std::uint32_t max_cyl = 199;
    HeadDirection dir = HeadDirection::Up;

    EventLog log("disk-" + policy_str);
    auto res = disk_sched->schedule(initial_head, dir, max_cyl, requests, &log);

    if (format == "json") {
      std::cout << "{\"events\":" << log.to_json()
                << ",\"result\":" << res.to_json() << "}\n";
    } else {
      std::cout << "========================================================\n"
                << " KernelLens Disk Scheduling: " << policy_str << "\n"
                << "========================================================\n"
                << " Initial Head Position:  " << initial_head << "\n"
                << " Total Seek Distance:    " << res.total_seek_distance << " cylinders\n"
                << " Service Order:          ";
      for (std::size_t i = 0; i < res.service_order.size(); ++i) {
        if (i > 0) std::cout << " -> ";
        std::cout << res.service_order[i];
      }
      std::cout << "\n========================================================\n";
    }
    return 0;
  }

  // -------------------------------------------------------------
  // Allocator Subsystem (Phase 9)
  // -------------------------------------------------------------
  if (module == "allocator") {
    std::size_t cap = capacity > 0 ? capacity : 1024;
    std::unique_ptr<IMemoryAllocator> alloc;
    EventLog log("allocator-" + policy_str);

    if (policy_str == "BEST_FIT" || policy_str == "BESTFIT") {
      alloc = std::make_unique<ContiguousAllocator>(cap, AllocationPolicy::BestFit, &log);
    } else if (policy_str == "WORST_FIT" || policy_str == "WORSTFIT") {
      alloc = std::make_unique<ContiguousAllocator>(cap, AllocationPolicy::WorstFit, &log);
    } else if (policy_str == "BUDDY") {
      alloc = std::make_unique<BuddyAllocator>(cap, 16, &log);
    } else {
      alloc = std::make_unique<ContiguousAllocator>(cap, AllocationPolicy::FirstFit, &log);
    }

    std::vector<AllocatorOp> ops = {
      {AllocatorOpKind::Allocate, 1, 100, std::nullopt},
      {AllocatorOpKind::Allocate, 2, 240, std::nullopt},
      {AllocatorOpKind::Allocate, 3, 64,  std::nullopt},
      {AllocatorOpKind::Allocate, 4, 256, std::nullopt},
      {AllocatorOpKind::Deallocate, 2, 0, std::nullopt},
      {AllocatorOpKind::Allocate, 5, 120, std::nullopt},
      {AllocatorOpKind::Allocate, 6, 300, std::nullopt},
      {AllocatorOpKind::Deallocate, 1, 0, std::nullopt},
      {AllocatorOpKind::Deallocate, 3, 0, std::nullopt},
      {AllocatorOpKind::Allocate, 7, 200, std::nullopt}
    };

    Tick current_tick = 0;
    for (const auto& op : ops) {
      current_tick += 10;
      if (op.kind == AllocatorOpKind::Allocate) {
        alloc->allocate(op.owner, op.bytes, current_tick);
      } else {
        alloc->deallocate(op.owner, current_tick);
      }
    }

    if (do_compact) {
      current_tick += 10;
      alloc->compact(current_tick);
    }

    auto m = alloc->compute_metrics();
    auto snap = alloc->snapshot();

    if (format == "json") {
      std::stringstream ss;
      ss << "{\"events\":" << log.to_json()
         << ",\"metrics\":" << m.to_json()
         << ",\"blocks\":[";
      for (std::size_t i = 0; i < snap.size(); ++i) {
        if (i > 0) ss << ",";
        const auto& b = snap[i];
        ss << "{\"id\":" << b.id
           << ",\"start\":" << b.start
           << ",\"size\":" << b.size
           << ",\"allocated\":" << (b.allocated ? "true" : "false")
           << ",\"owner\":" << (b.owner.has_value() ? std::to_string(*b.owner) : "null")
           << ",\"requested\":" << b.requested_bytes
           << ",\"order\":" << b.order << "}";
      }
      ss << "]}";
      std::cout << ss.str() << "\n";
    } else {
      std::cout << "========================================================\n"
                << " KernelLens Dynamic Memory Allocator: " << alloc->name() << "\n"
                << " Capacity: " << cap << " bytes" << (do_compact ? " (Compacted)" : "") << "\n"
                << "========================================================\n"
                << " Total Allocated:        " << m.total_allocated << " B\n"
                << " Total Free:             " << m.total_free << " B\n"
                << " Allocated Blocks:       " << m.allocated_block_count << "\n"
                << " Free Blocks:            " << m.free_block_count << "\n"
                << " Largest Free Block:     " << m.largest_free_block << " B\n"
                << " Internal Fragmentation: " << m.internal_fragmentation << " B\n"
                << " External Fragmentation: " << m.external_fragmentation << " B ("
                << std::fixed << std::setprecision(1) << (m.external_fragmentation_ratio * 100.0) << "%)\n"
                << " Memory Utilization:     " << std::fixed << std::setprecision(1) << (m.memory_utilization * 100.0) << "%\n"
                << "--------------------------------------------------------\n"
                << " Memory Block Layout:\n";
      for (const auto& b : snap) {
        std::cout << "  [" << std::setw(4) << b.start << " - " << std::setw(4) << (b.start + b.size)
                  << "] Size: " << std::setw(4) << b.size << " B | "
                  << (b.allocated ? ("OCCUPIED (Owner: " + std::to_string(*b.owner) + ", Req: " + std::to_string(b.requested_bytes) + "B)") : "FREE");
        if (b.order > 0) {
          std::cout << " (Order " << b.order << ")";
        }
        std::cout << "\n";
      }
      std::cout << "========================================================\n";
    }
    return 0;
  }

  // -------------------------------------------------------------
  // Filesystem Subsystem (Phase 10)
  // -------------------------------------------------------------
  if (module == "filesystem" || module == "fs") {
    EventLog log("fs-simulation");
    InodeFileSystem fs(512, fs_blocks, &log);
    JournalingFileSystem journal(&fs, &log);

    FileAllocationStrategy strat = FileAllocationStrategy::Indexed;
    if (fs_strategy_str == "CONTIGUOUS") strat = FileAllocationStrategy::Contiguous;
    else if (fs_strategy_str == "LINKED") strat = FileAllocationStrategy::Linked;

    // Build representative directory tree
    fs.create_directory("/bin", 0755);
    fs.create_directory("/home", 0755);
    fs.create_directory("/home/alice", 0700, UserContext::regular(1001, 1001));
    fs.create_directory("/home/bob", 0755, UserContext::regular(1002, 1002));
    fs.create_directory("/var", 0755);
    fs.create_directory("/var/log", 0755);

    fs.create_file("/bin/sh", "ELF-SIMULATED-SHELL-BINARY", 0755, FileAllocationStrategy::Contiguous, UserContext::root());
    fs.create_file("/home/alice/notes.txt", "Alice private secret notes", 0600, strat, UserContext::regular(1001, 1001));
    fs.create_file("/home/bob/public.txt", "Bob public announcement document", 0644, strat, UserContext::regular(1002, 1002));
    fs.create_file("/var/log/syslog", "KernelLens boot tick 0: all subsystems operational", 0644, FileAllocationStrategy::Linked, UserContext::root());

    // Journal crash recovery demonstration
    std::uint64_t tx1 = journal.begin_transaction("CREATE_FILE", "/var/log/audit.log", "Audit trail record", 0644, strat);
    journal.commit_transaction(tx1);

    std::uint64_t tx2 = journal.begin_transaction("CREATE_FILE", "/home/bob/lost.txt", "Uncommitted crash data", 0644, strat);
    journal.inject_crash(CrashPoint::PreCommit, tx2);

    std::uint64_t tx3 = journal.begin_transaction("CREATE_FILE", "/var/log/recovered.log", "Committed prior to crash", 0644, strat);
    journal.inject_crash(CrashPoint::PostCommitPreApply, tx3);

    auto recovery_report = journal.recover();
    auto m = fs.compute_metrics();

    if (format == "json") {
      std::ostringstream ss;
      ss << "{\"events\":" << log.to_json()
         << ",\"metrics\":" << m.to_json()
         << ",\"recovery\":" << recovery_report.to_json()
         << ",\"tree\":" << fs.to_json()
         << "}";
      std::cout << ss.str() << "\n";
    } else {
      std::cout << "========================================================\n"
                << " KernelLens Hierarchical Inode Filesystem (Phase 10)\n"
                << " Block Size: " << fs.block_size() << " B | Max Blocks: " << fs.total_blocks_capacity() << "\n"
                << " Default Allocation Strategy: " << to_string(strat) << "\n"
                << "========================================================\n"
                << " Total Inodes:     " << m.total_inodes << "\n"
                << " Directories:      " << m.directory_count << "\n"
                << " Files:            " << m.file_count << "\n"
                << " Data Stored:      " << m.total_data_bytes << " B\n"
                << " Used Blocks:      " << m.used_blocks << " / " << m.total_blocks << "\n"
                << " Free Blocks:      " << m.free_blocks << "\n"
                << "--------------------------------------------------------\n"
                << " Journal Crash Recovery Report:\n"
                << "  " << recovery_report.explanation << "\n"
                << "--------------------------------------------------------\n"
                << " Directory Hierarchy:\n"
                << fs.print_tree("/")
                << "========================================================\n";
    }
    return 0;
  }

  // -------------------------------------------------------------
  // IPC Subsystem (Phase 11)
  // -------------------------------------------------------------
  if (module == "ipc") {
    EventLog log("ipc-simulation");
    IpcManager ipc(&log);

    // 1. Pipe Demonstration (Producer -> Consumer with chunking and EOF)
    PipeId p1 = ipc.create_pipe(ipc_capacity, 20, 10, 0);
    Pipe* pipe = ipc.get_pipe(p1);
    if (pipe) {
      // Process 10 writes chunk 1
      pipe->write(std::vector<std::uint8_t>{0x41, 0x42, 0x43, 0x44}, 10, 1);
      // Process 20 reads 2 bytes
      pipe->read(2, 20, 2);
      // Process 10 writes chunk 2
      pipe->write(std::vector<std::uint8_t>{0x45, 0x46, 0x47, 0x48, 0x49}, 10, 3);
      // Process 10 closes write end (EOF signaling)
      ipc.close_pipe_write(p1, 10, 4);
      // Process 20 reads all remaining bytes until EOF (0 bytes)
      pipe->read(64, 20, 5);
      // Process 10 attempts writing to closed pipe -> EPIPE / SIGPIPE
      pipe->write(std::vector<std::uint8_t>{0xFF}, 10, 6);
    }

    // 2. Priority Message Queue Demonstration
    MqId q1 = ipc.create_mq("kernel-telemetry", mq_capacity, 256, 7);
    MessageQueue* mq = ipc.get_mq(q1);
    if (mq) {
      // Send bulk messages with varying priority and types
      mq->send(100, 1, 10, "LOW_PRIO_BACKGROUND_LOG", 8);
      mq->send(101, 2, 90, "CRITICAL_OOM_KERNEL_PANIC", 9);
      mq->send(102, 1, 50, "MEDIUM_PRIO_HEARTBEAT", 10);
      mq->send(103, 1, 10, "SECOND_LOW_PRIO_TASK", 11);

      // Receiver extracts highest priority message first (Priority 90 preempts!)
      mq->receive(200, 0, 12);
      // Receiver extracts type 1 specifically
      mq->receive(200, 1, 13);
    }

    // 3. Shared Memory & Data Race Detection Demonstration
    ShmId s1 = ipc.create_shm(0xCAFE, 1024, 14);
    SharedMemorySegment* shm = ipc.get_shm(s1);
    if (shm) {
      shm->attach(300, 0x10000, ShmPermission::ReadWrite, 15);
      shm->attach(301, 0x20000, ShmPermission::ReadWrite, 16);

      // Safe synchronized write using lock ID 1
      shm->write(300, 0, std::vector<std::uint8_t>{0x01, 0x02, 0x03}, 1, 17);

      // Unsynchronized concurrent write without lock -> Race condition detected!
      shm->write(300, 4, std::vector<std::uint8_t>{0xAA, 0xBB}, std::nullopt, 18);
      shm->write(301, 4, std::vector<std::uint8_t>{0xCC, 0xDD}, std::nullopt, 18);

      shm->detach(300, 19);
      shm->detach(301, 20);
    }

    auto m = ipc.compute_metrics();

    if (format == "json") {
      std::ostringstream ss;
      ss << "{\"events\":" << log.to_json()
         << ",\"metrics\":" << m.to_json()
         << ",\"ipc\":" << ipc.to_json()
         << "}";
      std::cout << ss.str() << "\n";
    } else {
      std::cout << "========================================================\n"
                << " KernelLens Inter-Process Communication (Phase 11)\n"
                << " Pipe Capacity: " << ipc_capacity << " B | MQ Max Msgs: " << mq_capacity << "\n"
                << "========================================================\n"
                << " Total Pipes:            " << m.total_pipes << "\n"
                << " Active Pipes:           " << m.active_pipes << "\n"
                << " Total Message Queues:   " << m.total_message_queues << "\n"
                << " Messages Queued:        " << m.total_messages_queued << "\n"
                << " Shared Memory Segments: " << m.total_shm_segments << "\n"
                << " Total Shm Bytes:        " << m.total_shm_bytes << " B\n"
                << " Data Race Hazards:      " << m.total_race_conditions << "\n"
                << " Total IPC Events:       " << log.size() << "\n"
                << "========================================================\n";
    }
    return 0;
  }

  // -------------------------------------------------------------
  // Syscall Subsystem (Phase 11)
  // -------------------------------------------------------------
  if (module == "syscall") {
    EventLog log("syscall-simulation");
    IpcManager ipc(&log);
    InodeFileSystem fs(512, 64, &log);
    SyscallDispatcher dispatcher(&log, &ipc, &fs);

    ProcessExecutionContext ctx(1001, 0x4000, 0xF000, 0x8000, 0);

    // 1. SYS_GETPID
    dispatcher.invoke(ctx, SyscallNumber::SysGetPid, {}, 1);

    // 2. SYS_PIPE
    auto r_pipe = dispatcher.invoke(ctx, SyscallNumber::SysPipe, {256}, 2);
    std::uint64_t pipe_id = static_cast<std::uint64_t>(r_pipe.return_value);

    // 3. SYS_WRITE to Pipe
    dispatcher.invoke(ctx, SyscallNumber::SysWrite, {pipe_id, 0x41424344, 4}, 3);

    // 4. SYS_READ from Pipe
    dispatcher.invoke(ctx, SyscallNumber::SysRead, {pipe_id, 0x2000, 4}, 4);

    // 5. SYS_MQ_SEND
    dispatcher.invoke(ctx, SyscallNumber::SysMqSend, {1, 99, 10}, 5);

    // 6. SYS_YIELD & SYS_SLEEP
    dispatcher.invoke(ctx, SyscallNumber::SysYield, {}, 6);
    dispatcher.invoke(ctx, SyscallNumber::SysSleep, {15}, 7);

    // 7. Error rejection: Invalid bad file descriptor
    dispatcher.invoke(ctx, SyscallNumber::SysClose, {9999}, 8);

    // 8. SYS_EXIT
    dispatcher.invoke(ctx, SyscallNumber::SysExit, {0}, 9);

    auto m = dispatcher.compute_metrics();

    if (format == "json") {
      std::ostringstream ss;
      ss << "{\"events\":" << log.to_json()
         << ",\"metrics\":" << m.to_json()
         << "}";
      std::cout << ss.str() << "\n";
    } else {
      std::cout << "========================================================\n"
                << " KernelLens Syscall & Hardware Trap Layer (Phase 11)\n"
                << " Execution Mode: Ring 3 User -> Ring 0 Kernel (Trap 0x80)\n"
                << "========================================================\n"
                << " Total Invocations:      " << m.total_invocations << "\n"
                << " Successful Calls:       " << m.successful_invocations << "\n"
                << " Rejected Calls:         " << m.failed_invocations << "\n"
                << " Kernel Ticks Spent:     " << m.total_kernel_ticks_spent << " ticks\n"
                << "--------------------------------------------------------\n"
                << " Call Distribution:\n";
      for (const auto& [name, count] : m.call_counts) {
        std::cout << "  " << std::left << std::setw(18) << name << " : " << count << "\n";
      }
      std::cout << "========================================================\n";
    }
    return 0;
  }

  // -------------------------------------------------------------
  // Interrupt Controller Subsystem (Phase 11)
  // -------------------------------------------------------------
  if (module == "interrupt" || module == "irq") {
    EventLog log("interrupt-simulation");
    InterruptController ic(&log);
    ProcessExecutionContext ctx(500, 0x1000, 0xF000, 0x8000, 0);

    // 1. Direct hardware interrupt dispatch
    ic.raise_interrupt(32, "PIT_TIMER", &ctx, 1);
    ic.complete_interrupt(32, ctx, 2);

    // 2. CLI Masking demonstration
    ic.disable_interrupts(3);
    ic.raise_interrupt(33, "KEYBOARD", &ctx, 4);   // Priority 20
    ic.raise_interrupt(46, "DISK_DMA", &ctx, 5);   // Priority 5

    // STI Unmasking -> Pending interrupts dispatched in strict priority order (Disk DMA then Keyboard)
    ic.enable_interrupts(6);
    ic.dispatch_pending(ctx, 7);
    ic.complete_interrupt(46, ctx, 8);
    ic.dispatch_pending(ctx, 9);
    ic.complete_interrupt(33, ctx, 10);

    // 3. Nested Priority Preemption demonstration
    // Start low-priority ISR (Keyboard priority 20)
    ic.raise_interrupt(33, "KEYBOARD", &ctx, 11);
    // Higher priority Disk DMA (priority 5) preempts Keyboard ISR!
    ic.raise_interrupt(46, "DISK_DMA", &ctx, 12);
    // Complete Disk DMA -> resumes Keyboard
    ic.complete_interrupt(46, ctx, 13);
    // Complete Keyboard
    ic.complete_interrupt(33, ctx, 14);

    auto m = ic.compute_metrics();

    if (format == "json") {
      std::ostringstream ss;
      ss << "{\"events\":" << log.to_json()
         << ",\"metrics\":" << m.to_json()
         << "}";
      std::cout << ss.str() << "\n";
    } else {
      std::cout << "========================================================\n"
                << " KernelLens Interrupt Vector Controller (Phase 11)\n"
                << " 256-Vector IVT | Priority Preemption | CLI/STI Masking\n"
                << "========================================================\n"
                << " Total Raised:           " << m.total_raised << "\n"
                << " Total Handled:          " << m.total_handled << "\n"
                << " Masked & Deferred:      " << m.total_masked_deferred << "\n"
                << " Nested Preemptions:     " << m.total_nested_interrupts << "\n"
                << " Peak Pending Queue:     " << m.peak_pending_queue << "\n"
                << "--------------------------------------------------------\n"
                << " Serviced Vector Distribution:\n";
      for (const auto& [name, count] : m.vector_counts) {
        std::cout << "  " << std::left << std::setw(18) << name << " : " << count << "\n";
      }
      std::cout << "========================================================\n";
    }
    return 0;
  }

  // -------------------------------------------------------------
  // Standard CPU Single-Policy Execution
  // -------------------------------------------------------------
  std::unique_ptr<IScheduler> scheduler;
  if (policy_str == "FCFS") {
    scheduler = std::make_unique<FcfsScheduler>();
  } else if (policy_str == "SJF") {
    scheduler = std::make_unique<SjfScheduler>();
  } else if (policy_str == "SRTF") {
    scheduler = std::make_unique<SrtfScheduler>();
  } else if (policy_str == "PRIORITY") {
    scheduler = std::make_unique<PriorityScheduler>(preemptive, aging);
  } else if (policy_str == "ROUND_ROBIN" || policy_str == "RR") {
    scheduler = std::make_unique<RoundRobinScheduler>(quantum);
  } else if (policy_str == "MLFQ") {
    scheduler = std::make_unique<MlfqScheduler>(std::vector<Tick>{quantum, quantum * 2, quantum * 4});
  } else if (policy_str == "CFS_LIKE" || policy_str == "CFS") {
    scheduler = std::make_unique<CfsLikeScheduler>(quantum * 2);
  } else {
    std::cerr << "Unknown policy: " << policy_str << "\n";
    return 1;
  }

  std::vector<ProcessSpec> workload;
  if (!workload_file.empty()) {
    workload = WorkloadGenerator::load_from_file(workload_file);
  } else if (preset_str == "convoy") {
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
  config.seed = seed;
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
