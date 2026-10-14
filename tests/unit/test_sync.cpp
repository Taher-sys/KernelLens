#include "test_harness.hpp"
#include "kernellens/sync/semaphore.hpp"
#include "kernellens/sync/resource_graph.hpp"

using namespace kernellens;
using namespace kernellens::testing;

TEST_CASE(Sync_SemaphoreCounting) {
  SimSemaphore sem("buffer", 2); // Buffer of size 2

  // First two acquisitions succeed without blocking
  ASSERT_TRUE(sem.wait(1, 0));
  ASSERT_EQ(sem.value(), 1);
  ASSERT_TRUE(sem.wait(2, 0));
  ASSERT_EQ(sem.value(), 0);

  // Third acquisition blocks process 3
  ASSERT_FALSE(sem.wait(3, 1));
  ASSERT_EQ(sem.value(), -1);
  ASSERT_EQ(sem.wait_queue().size(), 1);
  ASSERT_EQ(sem.wait_queue().front(), 3);

  // Signaling wakes process 3
  auto unblocked = sem.signal(2);
  ASSERT_TRUE(unblocked.has_value());
  ASSERT_EQ(*unblocked, 3);
  ASSERT_EQ(sem.value(), 0);
  ASSERT_EQ(sem.wait_queue().size(), 0);
}

TEST_CASE(Sync_MutexOwnership) {
  SimMutex mutex("printer");

  ASSERT_TRUE(mutex.lock(1, 0));
  ASSERT_TRUE(mutex.is_locked());
  ASSERT_EQ(mutex.owner().value(), 1);

  // P2 tries to lock -> blocks
  ASSERT_FALSE(mutex.lock(2, 1));

  // P1 releases -> P2 automatically inherits ownership
  auto next = mutex.unlock(1, 2);
  ASSERT_TRUE(next.has_value());
  ASSERT_EQ(*next, 2);
  ASSERT_EQ(mutex.owner().value(), 2);
}
