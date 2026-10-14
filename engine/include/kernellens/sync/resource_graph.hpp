#pragma once

#include "kernellens/core/types.hpp"
#include "kernellens/core/event_log.hpp"
#include <string>
#include <vector>
#include <map>
#include <set>

namespace kernellens {

struct RAGCycleReport {
  bool has_deadlock = false;
  std::vector<std::vector<std::string>> cycles;
  std::string to_json() const;
};

class ResourceAllocationGraph {
public:
  explicit ResourceAllocationGraph(EventLog* log = nullptr);

  void add_process(const std::string& process_id);
  void add_resource(const std::string& resource_id, int instances = 1);

  void add_request_edge(const std::string& process_id, const std::string& resource_id, Tick now = 0);
  void remove_request_edge(const std::string& process_id, const std::string& resource_id, Tick now = 0);

  void add_assignment_edge(const std::string& resource_id, const std::string& process_id, Tick now = 0);
  void remove_assignment_edge(const std::string& resource_id, const std::string& process_id, Tick now = 0);

  RAGCycleReport detect_deadlock(Tick now = 0) const;
  void clear();

  const std::set<std::string>& processes() const noexcept { return processes_; }
  const std::map<std::string, int>& resources() const noexcept { return resources_; }
  const std::map<std::string, std::set<std::string>>& adjacency_list() const noexcept { return adj_; }

private:
  EventLog* log_ = nullptr;
  std::set<std::string> processes_;
  std::map<std::string, int> resources_;
  std::map<std::string, std::set<std::string>> adj_; // Directed edges from u to v

  void dfs_find_cycles(const std::string& start, const std::string& current,
                        std::vector<std::string>& path,
                        std::set<std::string>& visited,
                        std::vector<std::vector<std::string>>& found_cycles) const;
};

} // namespace kernellens
