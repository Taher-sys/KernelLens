#include "kernellens/core/simulation.hpp"
#include "kernellens/core/engine.hpp"
#include "kernellens/cpu/fcfs.hpp"
#include "kernellens/cpu/sjf.hpp"
#include "kernellens/cpu/srtf.hpp"
#include "kernellens/cpu/priority.hpp"
#include "kernellens/cpu/round_robin.hpp"
#include "kernellens/cpu/mlfq.hpp"
#include "kernellens/cpu/cfs_like.hpp"
#include "kernellens/workload/presets.hpp"
#include "kernellens/memory/paging_system.hpp"
#include "kernellens/memory/replacers.hpp"
#include "kernellens/sync/banker.hpp"
#include "kernellens/sync/resource_graph.hpp"
#include "kernellens/disk/schedulers.hpp"

#include <stdexcept>
#include <algorithm>

namespace kernellens {

static std::string to_upper(std::string s) {
  for (char& c : s) {
    if (c >= 'a' && c <= 'z') c = static_cast<char>(c - 'a' + 'A');
  }
  return s;
}

SimulationResult Simulation::run(const SimulationRequest& req) {
  SimulationResult result;
  result.module = req.module;
  result.policy = req.policy;

  std::string mod = req.module;
  std::transform(mod.begin(), mod.end(), mod.begin(), ::tolower);

  if (mod == "cpu" || mod.empty()) {
    SimulationConfig config;
    config.run_id = req.run_id.empty() ? "sim-cpu" : req.run_id;
    config.seed = req.seed;
    SimulationEngine engine(config);

    std::string pol = to_upper(req.policy);
    if (pol == "FCFS") {
      engine.set_scheduler(std::make_unique<FcfsScheduler>());
    } else if (pol == "SJF") {
      engine.set_scheduler(std::make_unique<SjfScheduler>());
    } else if (pol == "SRTF") {
      engine.set_scheduler(std::make_unique<SrtfScheduler>());
    } else if (pol == "PRIORITY") {
      engine.set_scheduler(std::make_unique<PriorityScheduler>());
    } else if (pol == "ROUND_ROBIN" || pol == "RR") {
      Tick q = req.quantum > 0 ? req.quantum : 3;
      engine.set_scheduler(std::make_unique<RoundRobinScheduler>(q));
    } else if (pol == "MLFQ") {
      engine.set_scheduler(std::make_unique<MlfqScheduler>());
    } else if (pol == "CFS" || pol == "CFS_LIKE") {
      engine.set_scheduler(std::make_unique<CfsLikeScheduler>());
    } else {
      throw std::runtime_error("Unsupported CPU scheduling policy: " + req.policy);
    }

    if (!req.processes.empty()) {
      engine.load_workload(req.processes);
    } else {
      engine.load_workload(WorkloadPresets::convoy_effect());
    }

    engine.run();

    result.events = engine.event_log().to_json();
    result.metrics = engine.metrics().to_json();
    result.status_code = 0;
    return result;
  } else if (mod == "memory") {
    std::string pol = to_upper(req.policy);
    std::unique_ptr<IPageReplacer> replacer;
    if (pol == "FIFO") replacer = std::make_unique<FifoReplacer>();
    else if (pol == "LRU") replacer = std::make_unique<LruReplacer>();
    else if (pol == "OPTIMAL") replacer = std::make_unique<OptimalReplacer>();
    else if (pol == "CLOCK") replacer = std::make_unique<ClockReplacer>();
    else replacer = std::make_unique<FifoReplacer>();

    EventLog log(req.run_id.empty() ? "sim-mem" : req.run_id);
    std::size_t num_frames = req.quantum > 0 ? static_cast<std::size_t>(req.quantum) : 3;
    PagingSystem paging(num_frames, std::move(replacer), 4, &log);

    std::vector<std::uint32_t> refs = {7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2, 1, 2, 0, 1, 7, 0, 1};
    for (std::size_t i = 0; i < refs.size(); ++i) {
      paging.access(static_cast<Tick>(i), refs[i], i, refs);
    }

    result.events = log.to_json();
    result.metrics = paging.metrics().to_json();
    result.status_code = 0;
    return result;
  } else if (mod == "sync") {
    EventLog log(req.run_id.empty() ? "sim-sync" : req.run_id);
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
    result.events = log.to_json();
    result.metrics = safety.to_json();
    result.status_code = 0;
    return result;
  } else if (mod == "disk") {
    EventLog log(req.run_id.empty() ? "sim-disk" : req.run_id);
    std::string pol = to_upper(req.policy);
    std::unique_ptr<IDiskScheduler> sched;
    if (pol == "SSTF") sched = std::make_unique<DiskSstfScheduler>();
    else if (pol == "SCAN") sched = std::make_unique<DiskScanScheduler>();
    else if (pol == "C-SCAN" || pol == "CSCAN") sched = std::make_unique<DiskCScanScheduler>();
    else if (pol == "LOOK") sched = std::make_unique<DiskLookScheduler>();
    else if (pol == "C-LOOK" || pol == "CLOOK") sched = std::make_unique<DiskCLookScheduler>();
    else sched = std::make_unique<DiskFcfsScheduler>();

    std::vector<std::uint32_t> requests = {98, 183, 37, 122, 14, 124, 65, 67};
    auto sched_res = sched->schedule(53, HeadDirection::Up, 199, requests, &log);

    result.events = log.to_json();
    result.metrics = sched_res.to_json();
    result.status_code = 0;
    return result;
  }

  throw std::runtime_error("Unknown simulation module: " + req.module);
}

} // namespace kernellens
