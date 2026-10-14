#include "test_harness.hpp"
#include "kernellens/sync/banker.hpp"
#include "kernellens/sync/resource_graph.hpp"

using namespace kernellens;
using namespace kernellens::testing;

TEST_CASE(Golden_BankersAlgorithm_Silberschatz) {
  // 5 processes, 3 resource types (A, B, C)
  BankersAlgorithm banker(5, 3);

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

  // Check initial safety: must be SAFE
  auto initial_safety = banker.check_safety();
  ASSERT_TRUE(initial_safety.is_safe);
  ASSERT_EQ(initial_safety.safe_sequence.size(), 5);
  // P1 must be able to complete first because Need(P1) = [1, 2, 2] <= Available [3, 3, 2]
  ASSERT_EQ(initial_safety.safe_sequence[0], 1);

  // Request 1: P1 requests [1, 0, 2] -> Must be GRANTED
  auto req1 = banker.request_resources(1, {1, 0, 2}, 10);
  ASSERT_TRUE(req1.granted);
  ASSERT_EQ(req1.safe_sequence.size(), 5);

  // Request 2: P4 requests [3, 3, 0] -> exceeds available, must be DENIED
  auto req2 = banker.request_resources(4, {3, 3, 0}, 20);
  ASSERT_FALSE(req2.granted);

  // Request 3: P0 requests [0, 2, 0] -> would leave system in unsafe state, must be DENIED
  auto req3 = banker.request_resources(0, {0, 2, 0}, 30);
  ASSERT_FALSE(req3.granted);
}

TEST_CASE(Golden_RAG_DeadlockDetection) {
  ResourceAllocationGraph rag;

  // Add mutual dependency cycle: P1 -> R1 -> P2 -> R2 -> P1
  rag.add_request_edge("P1", "R1");
  rag.add_assignment_edge("R1", "P2");
  rag.add_request_edge("P2", "R2");
  rag.add_assignment_edge("R2", "P1");

  auto report1 = rag.detect_deadlock();
  ASSERT_TRUE(report1.has_deadlock);
  ASSERT_TRUE(report1.cycles.size() >= 1);

  // Break cycle by removing request edge P2 -> R2
  rag.remove_request_edge("P2", "R2");
  auto report2 = rag.detect_deadlock();
  ASSERT_FALSE(report2.has_deadlock);
  ASSERT_EQ(report2.cycles.size(), 0);
}
