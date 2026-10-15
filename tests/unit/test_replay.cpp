#include "kernellens/core/replay_engine.hpp"
#include "kernellens/cpu/round_robin.hpp"
#include "kernellens/cpu/fcfs.hpp"
#include "kernellens/workload/presets.hpp"
#include "test_harness.hpp"

using namespace kernellens;

TEST_CASE(Replay_CheckpointRecording_And_BinarySearch) {
  auto workload = WorkloadPresets::convoy_effect();

  SimulationConfig cfg;
  cfg.run_id = "test-replay-checkpoints";
  SimulationEngine engine(cfg);
  engine.set_scheduler(std::make_unique<RoundRobinScheduler>(3));
  engine.load_workload(workload);

  ReplayConfig r_cfg;
  r_cfg.checkpoint_interval_events = 2; // Capture frequent checkpoints for thorough testing
  r_cfg.capture_all_ticks = true;

  ReplayEngine replay(r_cfg);
  replay.record_session(engine);

  ASSERT_TRUE(replay.snapshot_count() >= 2);
  ASSERT_TRUE(replay.max_tick() > 0);

  // Test binary search lookup for nearest snapshot
  Tick mid_tick = replay.max_tick() / 2;
  auto nearest = replay.find_nearest_snapshot(mid_tick);
  ASSERT_TRUE(nearest.has_value());
  ASSERT_TRUE(nearest->tick <= mid_tick);

  // Reconstruct state at tick 0
  auto snap0 = replay.reconstruct_at_tick(0);
  ASSERT_EQ(snap0.tick, 0);

  // Reconstruct state at final tick
  auto snap_final = replay.reconstruct_at_tick(replay.max_tick());
  ASSERT_EQ(snap_final.tick, replay.max_tick());
}

TEST_CASE(Replay_DeterminismInvariant_ZeroDiscrepancy) {
  auto workload = WorkloadPresets::sjf_benchmark();

  SimulationConfig cfg;
  cfg.run_id = "test-replay-determinism";
  SimulationEngine engine(cfg);
  engine.set_scheduler(std::make_unique<FcfsScheduler>());
  engine.load_workload(workload);

  ReplayConfig r_cfg;
  r_cfg.checkpoint_interval_events = 3;
  r_cfg.capture_all_ticks = true;

  ReplayEngine replay(r_cfg);
  replay.record_session(engine);

  std::string err;
  bool verified = replay.verify_determinism(&err);
  ASSERT_TRUE_MSG(verified, err);

  // Check JSON export
  std::string json_str = replay.to_json();
  ASSERT_TRUE(json_str.find("\"schemaVersion\":1") != std::string::npos);
  ASSERT_TRUE(json_str.find("\"checkpoints\":[") != std::string::npos);
}
