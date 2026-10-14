#include "test_harness.hpp"
#include "kernellens/cpu/fcfs.hpp"
#include "kernellens/cpu/sjf.hpp"
#include "kernellens/cpu/srtf.hpp"
#include "kernellens/cpu/priority.hpp"
#include "kernellens/cpu/round_robin.hpp"
#include "kernellens/cpu/mlfq.hpp"
#include "kernellens/cpu/cfs_like.hpp"

using namespace kernellens;
using namespace kernellens::testing;

TEST_CASE(FCFS_FIFO_Order) {
  FcfsScheduler sched;
  std::vector<ProcessRuntime> procs;
  std::vector<ProcessId> ready;
  SchedulerContext ctx{0, std::nullopt, &procs, &ready};

  sched.on_ready(10, 0, ctx);
  sched.on_ready(20, 0, ctx);
  sched.on_ready(30, 0, ctx);

  ASSERT_EQ(sched.select_next(ctx).value(), 10);
  ASSERT_EQ(sched.select_next(ctx).value(), 20);
  ASSERT_EQ(sched.select_next(ctx).value(), 30);
  ASSERT_FALSE(sched.select_next(ctx).has_value());
}

TEST_CASE(SJF_ShortestBurstSelection) {
  SjfScheduler sched;
  std::vector<ProcessRuntime> procs;

  ProcessRuntime p1; p1.spec.pid = 1; p1.remaining_current_burst = 10; p1.spec.arrival_time = 0;
  ProcessRuntime p2; p2.spec.pid = 2; p2.remaining_current_burst = 3;  p2.spec.arrival_time = 1;
  ProcessRuntime p3; p3.spec.pid = 3; p3.remaining_current_burst = 7;  p3.spec.arrival_time = 2;
  procs = {p1, p2, p3};

  std::vector<ProcessId> ready = {1, 2, 3};
  SchedulerContext ctx{2, std::nullopt, &procs, &ready};

  sched.on_ready(1, 0, ctx);
  sched.on_ready(2, 1, ctx);
  sched.on_ready(3, 2, ctx);

  // Shortest burst is P2 (3), then P3 (7), then P1 (10)
  ASSERT_EQ(sched.select_next(ctx).value(), 2);
  ASSERT_EQ(sched.select_next(ctx).value(), 3);
  ASSERT_EQ(sched.select_next(ctx).value(), 1);
}

TEST_CASE(SRTF_PreemptionTrigger) {
  SrtfScheduler sched;
  std::vector<ProcessRuntime> procs;

  ProcessRuntime p1; p1.spec.pid = 1; p1.remaining_current_burst = 8;
  ProcessRuntime p2; p2.spec.pid = 2; p2.remaining_current_burst = 2;
  procs = {p1, p2};

  std::vector<ProcessId> ready = {2};
  SchedulerContext ctx{3, 1, &procs, &ready};

  sched.on_ready(2, 3, ctx);

  // P1 running with 8 remaining, P2 arrives with 2 remaining -> must preempt
  ASSERT_TRUE(sched.should_preempt(ctx));
}

TEST_CASE(Priority_AgingEffect) {
  PriorityScheduler sched(true, 10); // Preemptive with aging interval 10
  std::vector<ProcessRuntime> procs;

  ProcessRuntime p1; p1.spec.pid = 1; p1.spec.base_priority = 5; p1.last_ready_time = 0;
  procs = {p1};

  // At t=0, effective priority is 5
  ASSERT_EQ(sched.compute_effective_priority(p1, 0), 5);

  // At t=25, waiting 25 ticks with interval 10 improves priority by 2 (5 - 2 = 3)
  ASSERT_EQ(sched.compute_effective_priority(p1, 25), 3);

  // At t=50, waiting 50 ticks improves priority by 5 (5 - 5 = 0)
  ASSERT_EQ(sched.compute_effective_priority(p1, 50), 0);
}

TEST_CASE(RoundRobin_QuantumTimeSlice) {
  RoundRobinScheduler sched(4);
  std::vector<ProcessRuntime> procs;
  std::vector<ProcessId> ready;
  SchedulerContext ctx{0, std::nullopt, &procs, &ready};

  ASSERT_EQ(sched.time_slice(1, ctx).value(), 4);
}

TEST_CASE(CFS_NiceWeights) {
  // nice 0 -> 1024
  ASSERT_EQ(CfsLikeScheduler::nice_to_weight(0), 1024);
  // higher priority (nice -20) -> higher weight
  ASSERT_TRUE(CfsLikeScheduler::nice_to_weight(-20) > 1024);
  // lower priority (nice 19) -> lower weight
  ASSERT_TRUE(CfsLikeScheduler::nice_to_weight(19) < 1024);
}
