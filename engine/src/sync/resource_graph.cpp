#include "kernellens/sync/resource_graph.hpp"
#include <sstream>
#include <algorithm>

namespace kernellens {

ResourceAllocationGraph::ResourceAllocationGraph(EventLog* log) : log_(log) {}

void ResourceAllocationGraph::add_process(const std::string& process_id) {
  processes_.insert(process_id);
}

void ResourceAllocationGraph::add_resource(const std::string& resource_id, int instances) {
  resources_[resource_id] = instances;
}

void ResourceAllocationGraph::add_request_edge(const std::string& process_id, const std::string& resource_id, Tick now) {
  add_process(process_id);
  if (resources_.find(resource_id) == resources_.end()) {
    add_resource(resource_id, 1);
  }
  adj_[process_id].insert(resource_id);

  if (log_) {
    std::ostringstream ss;
    ss << "{\"from\":\"" << process_id << "\",\"to\":\"" << resource_id << "\",\"kind\":\"REQUEST\"}";
    log_->emit("sync", "rag_edge_added", std::nullopt, now, ss.str());
  }
}

void ResourceAllocationGraph::remove_request_edge(const std::string& process_id, const std::string& resource_id, Tick now) {
  if (adj_.find(process_id) != adj_.end()) {
    adj_[process_id].erase(resource_id);
  }
  if (log_) {
    std::ostringstream ss;
    ss << "{\"from\":\"" << process_id << "\",\"to\":\"" << resource_id << "\",\"kind\":\"REQUEST\"}";
    log_->emit("sync", "rag_edge_removed", std::nullopt, now, ss.str());
  }
}

void ResourceAllocationGraph::add_assignment_edge(const std::string& resource_id, const std::string& process_id, Tick now) {
  if (resources_.find(resource_id) == resources_.end()) {
    add_resource(resource_id, 1);
  }
  add_process(process_id);
  adj_[resource_id].insert(process_id);

  if (log_) {
    std::ostringstream ss;
    ss << "{\"from\":\"" << resource_id << "\",\"to\":\"" << process_id << "\",\"kind\":\"ASSIGNMENT\"}";
    log_->emit("sync", "rag_edge_added", std::nullopt, now, ss.str());
  }
}

void ResourceAllocationGraph::remove_assignment_edge(const std::string& resource_id, const std::string& process_id, Tick now) {
  if (adj_.find(resource_id) != adj_.end()) {
    adj_[resource_id].erase(process_id);
  }
  if (log_) {
    std::ostringstream ss;
    ss << "{\"from\":\"" << resource_id << "\",\"to\":\"" << process_id << "\",\"kind\":\"ASSIGNMENT\"}";
    log_->emit("sync", "rag_edge_removed", std::nullopt, now, ss.str());
  }
}

void ResourceAllocationGraph::dfs_find_cycles(const std::string& start, const std::string& current,
                                              std::vector<std::string>& path,
                                              std::set<std::string>& visited,
                                              std::vector<std::vector<std::string>>& found_cycles) const {
  visited.insert(current);
  path.push_back(current);

  auto it = adj_.find(current);
  if (it != adj_.end()) {
    for (const auto& neighbor : it->second) {
      if (neighbor == start && path.size() >= 3) {
        // Cycle completed
        std::vector<std::string> cycle = path;
        cycle.push_back(start);
        found_cycles.push_back(cycle);
      } else if (visited.find(neighbor) == visited.end()) {
        dfs_find_cycles(start, neighbor, path, visited, found_cycles);
      }
    }
  }

  path.pop_back();
  visited.erase(current);
}

RAGCycleReport ResourceAllocationGraph::detect_deadlock(Tick now) const {
  RAGCycleReport report;
  std::vector<std::vector<std::string>> all_cycles;

  for (const auto& p : processes_) {
    std::vector<std::string> path;
    std::set<std::string> visited;
    dfs_find_cycles(p, p, path, visited, all_cycles);
  }

  // Deduplicate cycles
  std::set<std::string> seen_cycle_strings;
  for (const auto& c : all_cycles) {
    std::ostringstream ss;
    for (const auto& node : c) ss << node << "->";
    std::string str = ss.str();
    if (seen_cycle_strings.find(str) == seen_cycle_strings.end()) {
      seen_cycle_strings.insert(str);
      report.cycles.push_back(c);
    }
  }

  report.has_deadlock = !report.cycles.empty();

  if (report.has_deadlock && log_) {
    log_->emit("sync", "deadlock_detected", std::nullopt, now, report.to_json());
  }

  return report;
}

void ResourceAllocationGraph::clear() {
  processes_.clear();
  resources_.clear();
  adj_.clear();
}

std::string RAGCycleReport::to_json() const {
  std::ostringstream ss;
  ss << "{"
     << "\"hasDeadlock\":" << (has_deadlock ? "true" : "false")
     << ",\"cycleCount\":" << cycles.size()
     << ",\"cycles\":[";
  for (std::size_t i = 0; i < cycles.size(); ++i) {
    if (i > 0) ss << ",";
    ss << "[";
    for (std::size_t j = 0; j < cycles[i].size(); ++j) {
      if (j > 0) ss << ",";
      ss << "\"" << cycles[i][j] << "\"";
    }
    ss << "]";
  }
  ss << "]}";
  return ss.str();
}

} // namespace kernellens
