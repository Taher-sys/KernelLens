#include "test_harness.hpp"
#include "kernellens/memory/allocator.hpp"

using namespace kernellens;
using namespace kernellens::testing;

TEST_CASE(Allocator_FirstFit_And_Coalesce) {
  ContiguousAllocator alloc(1000, AllocationPolicy::FirstFit);

  ASSERT_EQ(alloc.total_free(), 1000);

  // Allocate 200 to P1
  auto r1 = alloc.allocate(1, 200);
  ASSERT_TRUE(r1.success);
  ASSERT_EQ(alloc.total_free(), 800);

  // Allocate 300 to P2
  auto r2 = alloc.allocate(2, 300);
  ASSERT_TRUE(r2.success);
  ASSERT_EQ(alloc.total_free(), 500);

  // Deallocate P1
  ASSERT_TRUE(alloc.deallocate(1));
  ASSERT_EQ(alloc.total_free(), 700);

  // Deallocate P2 -> Should coalesce back to single 1000 block
  ASSERT_TRUE(alloc.deallocate(2));
  ASSERT_EQ(alloc.total_free(), 1000);
  ASSERT_EQ(alloc.snapshot().size(), 1);
}

TEST_CASE(Allocator_ExternalFragmentationDetection) {
  ContiguousAllocator alloc(1000, AllocationPolicy::FirstFit);

  // Allocate P1 (300), P2 (200), P3 (300), P4 (200)
  alloc.allocate(1, 300);
  alloc.allocate(2, 200);
  alloc.allocate(3, 300);
  alloc.allocate(4, 200);

  // Free P2 (200) and P4 (200) -> Free memory = 400, but largest hole is 200
  alloc.deallocate(2);
  alloc.deallocate(4);
  ASSERT_EQ(alloc.total_free(), 400);

  // Try to allocate 350 -> Should FAIL due to external fragmentation even though 400 is free!
  auto r_fail = alloc.allocate(5, 350);
  ASSERT_FALSE(r_fail.success);
  ASSERT_EQ(r_fail.external_fragmentation, 400);
}
