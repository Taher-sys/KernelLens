#include "kernellens/core/replay_engine.hpp"
#include <algorithm>
#include <sstream>

namespace kernellens {

ReplayEngine::ReplayEngine(ReplayConfig config) : config_(config) {}

void ReplayEngine::record_session(SimulationEngine& engine) {
  snapshots_.clear();
  full_tick_history_.clear();

  // Capture initial snapshot at tick 0
  auto init_snap = engine.take_snapshot();
  snapshots_.push_back(init_snap);
  if (config_.capture_all_ticks) {
    full_tick_history_.push_back(init_snap);
  }

  std::size_t last_snapshot_events = 0;
  Tick last_recorded_tick = init_snap.tick;

  while (!engine.is_finished()) {
    if (!engine.step()) {
      break;
    }

    auto current_snap = engine.take_snapshot();
    Tick now = current_snap.tick;

    if (config_.capture_all_ticks && now != last_recorded_tick) {
      full_tick_history_.push_back(current_snap);
      last_recorded_tick = now;
    }

    std::size_t current_events = engine.event_log().size();
    if (current_events - last_snapshot_events >= config_.checkpoint_interval_events) {
      snapshots_.push_back(current_snap);
      last_snapshot_events = current_events;
    }
  }

  // Final terminal snapshot
  auto final_snap = engine.take_snapshot();
  if (snapshots_.empty() || snapshots_.back() != final_snap) {
    snapshots_.push_back(final_snap);
  }
  if (config_.capture_all_ticks && (full_tick_history_.empty() || full_tick_history_.back() != final_snap)) {
    full_tick_history_.push_back(final_snap);
  }

  max_tick_ = final_snap.tick;
}

std::optional<EngineSnapshot> ReplayEngine::find_nearest_snapshot(Tick target_tick) const {
  if (snapshots_.empty()) return std::nullopt;

  auto it = std::upper_bound(
      snapshots_.begin(), snapshots_.end(), target_tick,
      [](Tick t, const EngineSnapshot& s) { return t < s.tick; });

  if (it == snapshots_.begin()) {
    if (snapshots_.front().tick <= target_tick) {
      return snapshots_.front();
    }
    return std::nullopt;
  }

  --it;
  return *it;
}

EngineSnapshot ReplayEngine::reconstruct_at_tick(Tick target_tick) const {
  if (full_tick_history_.empty()) {
    auto nearest = find_nearest_snapshot(target_tick);
    if (nearest.has_value()) return *nearest;
    return EngineSnapshot{};
  }

  auto it = std::upper_bound(
      full_tick_history_.begin(), full_tick_history_.end(), target_tick,
      [](Tick t, const EngineSnapshot& s) { return t < s.tick; });

  if (it == full_tick_history_.begin()) {
    return full_tick_history_.front();
  }

  --it;
  return *it;
}

bool ReplayEngine::verify_determinism(std::string* out_details) const {
  if (snapshots_.empty()) {
    if (out_details) *out_details = "No snapshots recorded.";
    return false;
  }

  // 1. Monotonicity check
  for (std::size_t i = 1; i < snapshots_.size(); ++i) {
    if (snapshots_[i].tick < snapshots_[i - 1].tick) {
      if (out_details) *out_details = "Checkpoint ticks are non-monotonic.";
      return false;
    }
    if (snapshots_[i].seq < snapshots_[i - 1].seq) {
      if (out_details) *out_details = "Checkpoint event sequences are non-monotonic.";
      return false;
    }
  }

  // 2. Binary search correctness
  for (const auto& snap : snapshots_) {
    auto nearest = find_nearest_snapshot(snap.tick);
    if (!nearest.has_value() || nearest->tick > snap.tick) {
      if (out_details) *out_details = "Nearest snapshot search violated upper-bound invariant.";
      return false;
    }
  }

  // 3. Exact reconstruction comparison against tick history
  for (const auto& hist_snap : full_tick_history_) {
    auto nearest = find_nearest_snapshot(hist_snap.tick);
    if (!nearest.has_value() || nearest->tick > hist_snap.tick) {
      if (out_details) *out_details = "No valid prior checkpoint for tick " + std::to_string(hist_snap.tick);
      return false;
    }

    auto reconstructed = reconstruct_at_tick(hist_snap.tick);
    if (reconstructed != hist_snap) {
      if (out_details) *out_details = "Reconstructed state mismatch at tick " + std::to_string(hist_snap.tick);
      return false;
    }
  }

  if (out_details) {
    *out_details = "Determinism verified across " + std::to_string(full_tick_history_.size()) +
                   " ticks and " + std::to_string(snapshots_.size()) + " periodic checkpoints.";
  }
  return true;
}

std::string ReplayEngine::to_json() const {
  std::ostringstream ss;
  ss << "{"
     << "\"schemaVersion\":1,"
     << "\"maxTick\":" << max_tick_ << ","
     << "\"checkpointCount\":" << snapshots_.size() << ","
     << "\"checkpoints\":[";

  for (std::size_t i = 0; i < snapshots_.size(); ++i) {
    if (i > 0) ss << ",";
    ss << snapshots_[i].to_json();
  }
  ss << "]}";
  return ss.str();
}

} // namespace kernellens
