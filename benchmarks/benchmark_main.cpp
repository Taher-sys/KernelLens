#include <chrono>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <memory>
#include <vector>

#include "kernellens/core/engine.hpp"
#include "kernellens/cpu/cfs_like.hpp"
#include "kernellens/cpu/fcfs.hpp"
#include "kernellens/cpu/mlfq.hpp"
#include "kernellens/cpu/priority.hpp"
#include "kernellens/cpu/round_robin.hpp"
#include "kernellens/cpu/sjf.hpp"
#include "kernellens/cpu/srtf.hpp"
#include "kernellens/disk/schedulers.hpp"
#include "kernellens/memory/paging_system.hpp"
#include "kernellens/memory/replacers.hpp"
#include "kernellens/sync/banker.hpp"
#include "kernellens/sync/resource_graph.hpp"
#include "kernellens/workload/generator.hpp"

using namespace kernellens;
using Clock = std::chrono::high_resolution_clock;

struct BenchmarkResult {
  std::string subsystem;
  std::string algorithm;
  std::size_t input_size;
  double elapsed_micros;
};

int main() {
  std::cout << "========================================================\n";
  std::cout << "   KernelLens Empirical Asymptotic Complexity Benchmarks\n";
  std::cout << "========================================================\n\n";

  std::vector<BenchmarkResult> results;

  // 1. CPU Schedulers Benchmark across scaling N
  std::vector<std::size_t> cpu_sizes = {10, 50, 100, 250, 500};
  std::cout << "--- Benchmarking CPU Schedulers (N processes) ---\n";
  std::cout << std::left << std::setw(15) << "Algorithm"
            << std::setw(10) << "Size (N)"
            << std::setw(18) << "Elapsed (us)"
            << std::setw(15) << "Throughput (P/ms)" << "\n";
  std::cout << std::string(58, '-') << "\n";

  for (auto n : cpu_sizes) {
    WorkloadGeneratorConfig cfg;
    cfg.seed = 42;
    cfg.num_processes = n;
    cfg.max_arrival_time = static_cast<Tick>(n * 2);
    cfg.min_burst = 2;
    cfg.max_burst = 20;
    cfg.io_probability = 0.0; // Pure CPU for scheduler scaling
    WorkloadGenerator gen(cfg);
    auto workload = gen.generate();

    // Test FCFS
    {
      SimulationEngine engine;
      engine.set_scheduler(std::make_unique<FcfsScheduler>());
      engine.load_workload(workload);
      auto start = Clock::now();
      engine.run();
      auto end = Clock::now();
      double us = std::chrono::duration<double, std::micro>(end - start).count();
      results.push_back({"CPU", "FCFS", n, us});
      std::cout << std::left << std::setw(15) << "FCFS"
                << std::setw(10) << n
                << std::setw(18) << std::fixed << std::setprecision(1) << us
                << std::setw(15) << std::fixed << std::setprecision(2) << (n * 1000.0 / (us > 0 ? us : 1)) << "\n";
    }

    // Test Round Robin (q=2)
    {
      SimulationEngine engine;
      engine.set_scheduler(std::make_unique<RoundRobinScheduler>(2));
      engine.load_workload(workload);
      auto start = Clock::now();
      engine.run();
      auto end = Clock::now();
      double us = std::chrono::duration<double, std::micro>(end - start).count();
      results.push_back({"CPU", "RoundRobin", n, us});
      std::cout << std::left << std::setw(15) << "RoundRobin"
                << std::setw(10) << n
                << std::setw(18) << std::fixed << std::setprecision(1) << us
                << std::setw(15) << std::fixed << std::setprecision(2) << (n * 1000.0 / (us > 0 ? us : 1)) << "\n";
    }

    // Test SRTF
    {
      SimulationEngine engine;
      engine.set_scheduler(std::make_unique<SrtfScheduler>());
      engine.load_workload(workload);
      auto start = Clock::now();
      engine.run();
      auto end = Clock::now();
      double us = std::chrono::duration<double, std::micro>(end - start).count();
      results.push_back({"CPU", "SRTF", n, us});
      std::cout << std::left << std::setw(15) << "SRTF"
                << std::setw(10) << n
                << std::setw(18) << std::fixed << std::setprecision(1) << us
                << std::setw(15) << std::fixed << std::setprecision(2) << (n * 1000.0 / (us > 0 ? us : 1)) << "\n";
    }

    // Test MLFQ
    {
      SimulationEngine engine;
      engine.set_scheduler(std::make_unique<MlfqScheduler>(std::vector<Tick>{2, 4, 8}, 50));
      engine.load_workload(workload);
      auto start = Clock::now();
      engine.run();
      auto end = Clock::now();
      double us = std::chrono::duration<double, std::micro>(end - start).count();
      results.push_back({"CPU", "MLFQ", n, us});
      std::cout << std::left << std::setw(15) << "MLFQ"
                << std::setw(10) << n
                << std::setw(18) << std::fixed << std::setprecision(1) << us
                << std::setw(15) << std::fixed << std::setprecision(2) << (n * 1000.0 / (us > 0 ? us : 1)) << "\n";
    }
  }

  // 2. Virtual Memory Paging Benchmark across reference string length M
  std::vector<std::size_t> mem_sizes = {100, 500, 1000, 2500, 5000};
  std::cout << "\n--- Benchmarking Virtual Memory Page Replacers (M accesses, 4 frames) ---\n";
  std::cout << std::left << std::setw(15) << "Algorithm"
            << std::setw(10) << "Length (M)"
            << std::setw(18) << "Elapsed (us)"
            << std::setw(15) << "Faults" << "\n";
  std::cout << std::string(58, '-') << "\n";

  for (auto m : mem_sizes) {
    WorkloadGenerator gen;
    auto refs = gen.generate_page_reference_string(m, 20);

    // FIFO
    {
      PagingSystem sys(4, std::make_unique<FifoReplacer>());
      auto start = Clock::now();
      for (std::size_t i = 0; i < refs.size(); ++i) {
        sys.access(static_cast<Tick>(i), refs[i], i, refs);
      }
      auto end = Clock::now();
      double us = std::chrono::duration<double, std::micro>(end - start).count();
      results.push_back({"Memory", "FIFO", m, us});
      std::cout << std::left << std::setw(15) << "FIFO"
                << std::setw(10) << m
                << std::setw(18) << std::fixed << std::setprecision(1) << us
                << std::setw(15) << sys.metrics().page_faults << "\n";
    }

    // LRU
    {
      PagingSystem sys(4, std::make_unique<LruReplacer>());
      auto start = Clock::now();
      for (std::size_t i = 0; i < refs.size(); ++i) {
        sys.access(static_cast<Tick>(i), refs[i], i, refs);
      }
      auto end = Clock::now();
      double us = std::chrono::duration<double, std::micro>(end - start).count();
      results.push_back({"Memory", "LRU", m, us});
      std::cout << std::left << std::setw(15) << "LRU"
                << std::setw(10) << m
                << std::setw(18) << std::fixed << std::setprecision(1) << us
                << std::setw(15) << sys.metrics().page_faults << "\n";
    }

    // CLOCK
    {
      PagingSystem sys(4, std::make_unique<ClockReplacer>());
      auto start = Clock::now();
      for (std::size_t i = 0; i < refs.size(); ++i) {
        sys.access(static_cast<Tick>(i), refs[i], i, refs);
      }
      auto end = Clock::now();
      double us = std::chrono::duration<double, std::micro>(end - start).count();
      results.push_back({"Memory", "CLOCK", m, us});
      std::cout << std::left << std::setw(15) << "CLOCK"
                << std::setw(10) << m
                << std::setw(18) << std::fixed << std::setprecision(1) << us
                << std::setw(15) << sys.metrics().page_faults << "\n";
    }

    // Optimal
    {
      PagingSystem sys(4, std::make_unique<OptimalReplacer>());
      auto start = Clock::now();
      for (std::size_t i = 0; i < refs.size(); ++i) {
        sys.access(static_cast<Tick>(i), refs[i], i, refs);
      }
      auto end = Clock::now();
      double us = std::chrono::duration<double, std::micro>(end - start).count();
      results.push_back({"Memory", "OPTIMAL", m, us});
      std::cout << std::left << std::setw(15) << "OPTIMAL"
                << std::setw(10) << m
                << std::setw(18) << std::fixed << std::setprecision(1) << us
                << std::setw(15) << sys.metrics().page_faults << "\n";
    }
  }

  // 3. Disk Schedulers Benchmark across request count K
  std::vector<std::size_t> disk_sizes = {50, 100, 250, 500, 1000};
  std::cout << "\n--- Benchmarking Disk Schedulers (K requests, 200 cylinders) ---\n";
  std::cout << std::left << std::setw(15) << "Algorithm"
            << std::setw(10) << "Size (K)"
            << std::setw(18) << "Elapsed (us)"
            << std::setw(15) << "Seek Distance" << "\n";
  std::cout << std::string(58, '-') << "\n";

  for (auto k : disk_sizes) {
    WorkloadGenerator gen;
    auto reqs = gen.generate_disk_requests(k, 199);

    std::vector<std::pair<std::string, std::unique_ptr<IDiskScheduler>>> policies;
    policies.emplace_back("FCFS", std::make_unique<DiskFcfsScheduler>());
    policies.emplace_back("SSTF", std::make_unique<DiskSstfScheduler>());
    policies.emplace_back("SCAN", std::make_unique<DiskScanScheduler>());
    policies.emplace_back("C-SCAN", std::make_unique<DiskCScanScheduler>());
    policies.emplace_back("LOOK", std::make_unique<DiskLookScheduler>());
    policies.emplace_back("C-LOOK", std::make_unique<DiskCLookScheduler>());

    for (auto& [pname, pol] : policies) {
      auto start = Clock::now();
      auto res = pol->schedule(53, HeadDirection::Up, 199, reqs, nullptr);
      auto end = Clock::now();
      double us = std::chrono::duration<double, std::micro>(end - start).count();
      results.push_back({"Disk", pname, k, us});
      std::cout << std::left << std::setw(15) << pname
                << std::setw(10) << k
                << std::setw(18) << std::fixed << std::setprecision(1) << us
                << std::setw(15) << res.total_seek_distance << "\n";
    }
  }

  // Export results to CSV
  std::ofstream csv("benchmarks/results/scaling_results.csv");
  if (csv.is_open()) {
    csv << "subsystem,algorithm,input_size,elapsed_micros\n";
    for (const auto& r : results) {
      csv << r.subsystem << "," << r.algorithm << "," << r.input_size << "," << r.elapsed_micros << "\n";
    }
    csv.close();
    std::cout << "\n[✓] Results successfully exported to benchmarks/results/scaling_results.csv\n";
  }

  std::cout << "\n========================================================\n";
  std::cout << "   Benchmark Completed Successfully!\n";
  std::cout << "========================================================\n";

  return 0;
}
