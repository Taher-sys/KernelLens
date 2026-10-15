#include "test_harness.hpp"
#include "kernellens/memory/allocator.hpp"

using namespace kernellens;
using namespace kernellens::testing;

TEST_CASE(BuddyAllocator_Basic_Split_And_InternalFragmentation) {
  // 1024-byte capacity, minimum block 16 bytes
  BuddyAllocator buddy(1024, 16);

  ASSERT_EQ(buddy.total_capacity(), 1024);
  ASSERT_EQ(buddy.total_free(), 1024);

  // Allocate 70 bytes for Owner 1.
  // 70 rounds up to power-of-two 128 (order 7).
  // Splits: 1024 -> 512, 512 -> 256, 256 -> 128, 128.
  auto res = buddy.allocate(1, 70);
  ASSERT_TRUE(res.success);
  ASSERT_EQ(res.start_address, 0);
  ASSERT_EQ(res.requested, 70);
  ASSERT_EQ(res.allocated, 128);
  ASSERT_EQ(res.internal_fragmentation, 58); // 128 - 70 = 58

  auto m = buddy.compute_metrics();
  ASSERT_EQ(m.total_allocated, 128);
  ASSERT_EQ(m.total_free, 1024 - 128);
  ASSERT_EQ(m.internal_fragmentation, 58);
  ASSERT_EQ(m.allocated_block_count, 1);

  // Free blocks in pool should be: 128 (at 128), 256 (at 256), 512 (at 512)
  auto snap = buddy.snapshot();
  ASSERT_EQ(snap.size(), 4);
  ASSERT_EQ(snap[0].start, 0);
  ASSERT_EQ(snap[0].size, 128);
  ASSERT_TRUE(snap[0].allocated);

  ASSERT_EQ(snap[1].start, 128);
  ASSERT_EQ(snap[1].size, 128);
  ASSERT_FALSE(snap[1].allocated);

  ASSERT_EQ(snap[2].start, 256);
  ASSERT_EQ(snap[2].size, 256);
  ASSERT_FALSE(snap[2].allocated);

  ASSERT_EQ(snap[3].start, 512);
  ASSERT_EQ(snap[3].size, 512);
  ASSERT_FALSE(snap[3].allocated);
}

TEST_CASE(BuddyAllocator_Coalescing_Recursive_Merge) {
  BuddyAllocator buddy(1024, 16);

  // Allocate A (100) -> 128 at offset 0
  auto rA = buddy.allocate(1, 100);
  ASSERT_TRUE(rA.success);
  ASSERT_EQ(rA.start_address, 0);

  // Allocate B (100) -> 128 at offset 128 (Buddy of A!)
  auto rB = buddy.allocate(2, 100);
  ASSERT_TRUE(rB.success);
  ASSERT_EQ(rB.start_address, 128);

  // Allocate C (240) -> 256 at offset 256 (Buddy of the [0, 256) block!)
  auto rC = buddy.allocate(3, 240);
  ASSERT_TRUE(rC.success);
  ASSERT_EQ(rC.start_address, 256);

  // Free A (offset 0). Cannot coalesce yet because B is occupied.
  ASSERT_TRUE(buddy.deallocate(1));
  ASSERT_EQ(buddy.snapshot()[0].allocated, false);
  ASSERT_EQ(buddy.snapshot()[0].size, 128);

  // Free B (offset 128).
  // A and B coalesce into 256 at offset 0!
  // But C is at offset 256, so [0, 256) cannot coalesce with [256, 512).
  ASSERT_TRUE(buddy.deallocate(2));
  auto snap1 = buddy.snapshot();
  ASSERT_EQ(snap1[0].start, 0);
  ASSERT_EQ(snap1[0].size, 256);
  ASSERT_FALSE(snap1[0].allocated);

  // Now Free C (offset 256).
  // [0, 256) and [256, 512) coalesce into 512 at offset 0!
  // Then [0, 512) and [512, 1024) coalesce into single 1024 block!
  ASSERT_TRUE(buddy.deallocate(3));
  auto snap2 = buddy.snapshot();
  ASSERT_EQ(snap2.size(), 1);
  ASSERT_EQ(snap2[0].start, 0);
  ASSERT_EQ(snap2[0].size, 1024);
  ASSERT_FALSE(snap2[0].allocated);
  ASSERT_EQ(buddy.total_free(), 1024);
}

TEST_CASE(BuddyAllocator_NonBuddy_SameSize_DoesNotMerge) {
  // Verifies that adjacent blocks of identical size do NOT merge unless they form a valid buddy pair.
  BuddyAllocator buddy(1024, 16);

  // Split down to four 256 blocks:
  // Allocate A(256) at 0, B(256) at 256, C(256) at 512, D(256) at 768
  buddy.allocate(1, 256);
  buddy.allocate(2, 256);
  buddy.allocate(3, 256);
  buddy.allocate(4, 256);

  // Free B (offset 256) and C (offset 512).
  // Both are 256 bytes and adjacent in memory!
  // BUT: 256 % (2 * 256) = 256 != 0. They are NOT buddies!
  // Block B's buddy is Block A (offset 0).
  // Block C's buddy is Block D (offset 768).
  buddy.deallocate(2);
  buddy.deallocate(3);

  auto snap = buddy.snapshot();
  // We must still have 4 blocks: A(alloc, 0), B(free, 256), C(free, 512), D(alloc, 768)
  ASSERT_EQ(snap.size(), 4);
  ASSERT_EQ(snap[1].start, 256);
  ASSERT_EQ(snap[1].size, 256);
  ASSERT_FALSE(snap[1].allocated);

  ASSERT_EQ(snap[2].start, 512);
  ASSERT_EQ(snap[2].size, 256);
  ASSERT_FALSE(snap[2].allocated);

  // Now free A -> merges with B into [0, 512)
  buddy.deallocate(1);
  auto snap_after_A = buddy.snapshot();
  ASSERT_EQ(snap_after_A[0].start, 0);
  ASSERT_EQ(snap_after_A[0].size, 512);

  // Now free D -> merges with C into [512, 1024), which then merges with [0, 512) into 1024
  buddy.deallocate(4);
  ASSERT_EQ(buddy.snapshot().size(), 1);
  ASSERT_EQ(buddy.total_free(), 1024);
}

TEST_CASE(BuddyAllocator_ExactPowerOfTwo_And_MinBlock) {
  BuddyAllocator buddy(512, 32);

  // Exact power of two request
  auto r_exact = buddy.allocate(1, 64);
  ASSERT_TRUE(r_exact.success);
  ASSERT_EQ(r_exact.allocated, 64);
  ASSERT_EQ(r_exact.internal_fragmentation, 0); // Exact fit!

  // Request below min_block_size (32)
  auto r_small = buddy.allocate(2, 8);
  ASSERT_TRUE(r_small.success);
  ASSERT_EQ(r_small.allocated, 32);
  ASSERT_EQ(r_small.internal_fragmentation, 24); // 32 - 8 = 24

  // Free by block_id
  ASSERT_TRUE(r_exact.block_id.has_value());
  auto d = buddy.deallocate_by_id(*r_exact.block_id);
  ASSERT_TRUE(d.success);
  ASSERT_EQ(d.freed_bytes, 64);
}

TEST_CASE(BuddyAllocator_EdgeCases_And_DoubleFree) {
  BuddyAllocator buddy(256, 16);

  // Zero byte allocation
  auto r0 = buddy.allocate(1, 0);
  ASSERT_FALSE(r0.success);

  // Exceeding capacity
  auto r_huge = buddy.allocate(1, 512);
  ASSERT_FALSE(r_huge.success);

  // Free non-existent owner
  ASSERT_FALSE(buddy.deallocate(999));

  // Free non-existent block ID
  auto d_fail = buddy.deallocate_by_id(888);
  ASSERT_FALSE(d_fail.success);

  // Double free
  buddy.allocate(10, 64);
  ASSERT_TRUE(buddy.deallocate(10));
  ASSERT_FALSE(buddy.deallocate(10)); // Double free rejected
}

TEST_CASE(BuddyAllocator_Invariants_StressSequence) {
  BuddyAllocator buddy(1024, 16);

  // Deterministic pattern: Allocate 6 processes of varying sizes
  buddy.allocate(1, 45);   // -> 64
  buddy.allocate(2, 110);  // -> 128
  buddy.allocate(3, 200);  // -> 256
  buddy.allocate(4, 30);   // -> 32
  buddy.allocate(5, 75);   // -> 128
  buddy.allocate(6, 15);   // -> 16 (min_block_size)

  // Validate invariants
  auto validate_invariants = [&buddy]() {
    auto snap = buddy.snapshot();
    std::size_t offset = 0;
    std::size_t total_free_count = 0;
    std::size_t total_alloc_count = 0;

    for (const auto& b : snap) {
      ASSERT_EQ(b.start, offset);
      offset += b.size;
      // Block size must be a power of two >= min_block_size
      ASSERT_TRUE((b.size & (b.size - 1)) == 0);
      ASSERT_TRUE(b.size >= buddy.min_block_size());

      if (b.allocated) {
        total_alloc_count += b.size;
        ASSERT_TRUE(b.owner.has_value());
        ASSERT_TRUE(b.requested_bytes <= b.size);
      } else {
        total_free_count += b.size;
      }
    }
    ASSERT_EQ(offset, buddy.total_capacity());
    ASSERT_EQ(total_free_count + total_alloc_count, buddy.total_capacity());
    ASSERT_EQ(total_free_count, buddy.total_free());
  };

  validate_invariants();

  // Deallocate all in arbitrary order: 3, 1, 5, 2, 6, 4
  ASSERT_TRUE(buddy.deallocate(3));
  validate_invariants();
  ASSERT_TRUE(buddy.deallocate(1));
  validate_invariants();
  ASSERT_TRUE(buddy.deallocate(5));
  validate_invariants();
  ASSERT_TRUE(buddy.deallocate(2));
  validate_invariants();
  ASSERT_TRUE(buddy.deallocate(6));
  validate_invariants();
  ASSERT_TRUE(buddy.deallocate(4));
  validate_invariants();

  // Full tree should be restored to 1 block of 1024
  ASSERT_EQ(buddy.total_free(), 1024);
  ASSERT_EQ(buddy.snapshot().size(), 1);
  ASSERT_EQ(buddy.snapshot()[0].size, 1024);
}
