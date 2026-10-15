#pragma once

#include "kernellens/core/engine.hpp"
#include <vector>
#include <string>
#include <optional>

namespace kernellens {

struct ReplayConfig {
  std::size_t checkpoint_interval_events = 50; // K=50 per ADR-03
  bool capture_all_ticks = true;
};

class ReplayEngine {
public:
  explicit ReplayEngine(ReplayConfig config = {});

  // Runs a complete simulation session while capturing periodic checkpoints
  void record_session(SimulationEngine& engine);

  // Snapshot querying
  const std::vector<EngineSnapshot>& snapshots() const noexcept { return snapshots_; }
  std::size_t snapshot_count() const noexcept { return snapshots_.size(); }
  Tick max_tick() const noexcept { return max_tick_; }

  // Binary search for nearest snapshot with tick <= target_tick (O(log K))
  std::optional<EngineSnapshot> find_nearest_snapshot(Tick target_tick) const;

  // Exact state reconstruction at target_tick
  EngineSnapshot reconstruct_at_tick(Tick target_tick) const;

  // Invariant verification: asserts determinism and zero reverse mutations
  bool verify_determinism(std::string* out_details = nullptr) const;

  // JSON export of checkpoints conforming to schemaVersion: 1
  std::string to_json() const;

private:
  ReplayConfig config_;
  std::vector<EngineSnapshot> snapshots_;
  std::vector<EngineSnapshot> full_tick_history_;
  Tick max_tick_ = 0;
};

} // namespace kernellens
