#include "test_harness.hpp"
#include "kernellens/core/clock.hpp"

using namespace kernellens;
using namespace kernellens::testing;

TEST_CASE(Clock_InitialState) {
  SimClock clock;
  ASSERT_EQ(clock.now(), 0);
  ASSERT_FALSE(clock.has_events());
  ASSERT_EQ(clock.pending_event_count(), 0);
}

TEST_CASE(Clock_MonotonicAdvance) {
  SimClock clock;
  std::vector<Tick> executed_times;

  clock.schedule(10, EventPriority::Normal, "event1", [&](Tick t) {
    executed_times.push_back(t);
  });
  clock.schedule(5, EventPriority::Normal, "event2", [&](Tick t) {
    executed_times.push_back(t);
  });
  clock.schedule(15, EventPriority::Normal, "event3", [&](Tick t) {
    executed_times.push_back(t);
  });

  ASSERT_EQ(clock.pending_event_count(), 3);
  ASSERT_EQ(clock.next_event_time(), 5);

  ASSERT_TRUE(clock.step());
  ASSERT_EQ(clock.now(), 5);

  ASSERT_TRUE(clock.step());
  ASSERT_EQ(clock.now(), 10);

  ASSERT_TRUE(clock.step());
  ASSERT_EQ(clock.now(), 15);

  ASSERT_FALSE(clock.step());
  ASSERT_EQ(executed_times.size(), 3);
  ASSERT_EQ(executed_times[0], 5);
  ASSERT_EQ(executed_times[1], 10);
  ASSERT_EQ(executed_times[2], 15);
}

TEST_CASE(Clock_PriorityTieBreaking) {
  SimClock clock;
  std::vector<std::string> order;

  // At the exact same tick (10), High priority must run before Normal, which runs before Low
  clock.schedule(10, EventPriority::Low, "low", [&](Tick) { order.push_back("low"); });
  clock.schedule(10, EventPriority::High, "high", [&](Tick) { order.push_back("high"); });
  clock.schedule(10, EventPriority::Normal, "normal", [&](Tick) { order.push_back("normal"); });

  while (clock.has_events()) {
    clock.step();
  }

  ASSERT_EQ(order.size(), 3);
  ASSERT_EQ(order[0], "high");
  ASSERT_EQ(order[1], "normal");
  ASSERT_EQ(order[2], "low");
}
