#include "test_harness.hpp"
#include "kernellens/memory/allocator.hpp"
#include <random>

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

TEST_CASE(Allocator_FirstFit_BestFit_WorstFit_PolicyDifferences) {
  // Create a layout with two holes: Hole 1 of size 300 at offset 100, Hole 2 of size 200 at offset 500.
  auto setup_holes = [](IMemoryAllocator& a) {
    a.allocate(1, 100); // 0-100
    a.allocate(2, 300); // 100-400
    a.allocate(3, 100); // 400-500
    a.allocate(4, 200); // 500-700
    a.allocate(5, 300); // 700-1000
    a.deallocate(2);    // Free hole 1: [100, 400), size 300
    a.deallocate(4);    // Free hole 2: [500, 700), size 200
  };

  // 1. First-Fit: allocates 150 bytes into the FIRST hole that fits -> Hole 1 at 100
  ContiguousAllocator ff(1000, AllocationPolicy::FirstFit);
  setup_holes(ff);
  auto r_ff = ff.allocate(6, 150);
  ASSERT_TRUE(r_ff.success);
  ASSERT_EQ(r_ff.start_address, 100);

  // 2. Best-Fit: allocates 150 bytes into the SMALLEST hole that fits -> Hole 2 (size 200) at 500
  ContiguousAllocator bf(1000, AllocationPolicy::BestFit);
  setup_holes(bf);
  auto r_bf = bf.allocate(6, 150);
  ASSERT_TRUE(r_bf.success);
  ASSERT_EQ(r_bf.start_address, 500);

  // 3. Worst-Fit: allocates 150 bytes into the LARGEST hole that fits -> Hole 1 (size 300) at 100
  ContiguousAllocator wf(1000, AllocationPolicy::WorstFit);
  setup_holes(wf);
  auto r_wf = wf.allocate(6, 150);
  ASSERT_TRUE(r_wf.success);
  ASSERT_EQ(r_wf.start_address, 100);
}

TEST_CASE(Allocator_EdgeCases_Zero_And_ExactFit_And_Overflow) {
  ContiguousAllocator alloc(500, AllocationPolicy::FirstFit);

  // Zero-byte allocation
  auto r_zero = alloc.allocate(1, 0);
  ASSERT_FALSE(r_zero.success);
  ASSERT_EQ(r_zero.reason, "Cannot allocate 0 bytes");

  // Allocation larger than capacity
  auto r_huge = alloc.allocate(2, 1000);
  ASSERT_FALSE(r_huge.success);
  ASSERT_EQ(r_huge.reason, "Requested size exceeds total memory capacity");

  // Exact fit: entire capacity
  auto r_exact = alloc.allocate(3, 500);
  ASSERT_TRUE(r_exact.success);
  ASSERT_EQ(r_exact.start_address, 0);
  ASSERT_EQ(r_exact.allocated, 500);
  ASSERT_EQ(alloc.total_free(), 0);
  ASSERT_EQ(alloc.snapshot().size(), 1);

  // Subsequent allocation when full
  auto r_full = alloc.allocate(4, 1);
  ASSERT_FALSE(r_full.success);
  ASSERT_EQ(r_full.reason, "Allocation failed (out of total free memory)");

  // Deallocate exact block
  ASSERT_TRUE(alloc.deallocate(3));
  ASSERT_EQ(alloc.total_free(), 500);
}

TEST_CASE(Allocator_InvalidFrees_And_DoubleFrees) {
  ContiguousAllocator alloc(1000, AllocationPolicy::FirstFit);

  // Non-existent owner free
  ASSERT_FALSE(alloc.deallocate(999));

  // Non-existent block_id free
  auto d_invalid = alloc.deallocate_by_id(999);
  ASSERT_FALSE(d_invalid.success);

  // Valid allocation
  auto r = alloc.allocate(42, 250);
  ASSERT_TRUE(r.success);
  ASSERT_TRUE(r.block_id.has_value());
  std::uint32_t bid = *r.block_id;

  // First free by block_id succeeds
  auto d1 = alloc.deallocate_by_id(bid);
  ASSERT_TRUE(d1.success);
  ASSERT_EQ(d1.freed_bytes, 250);

  // Double free by block_id fails
  auto d2 = alloc.deallocate_by_id(bid);
  ASSERT_FALSE(d2.success);

  // Double free by owner fails
  auto r2 = alloc.allocate(100, 200);
  ASSERT_TRUE(r2.success);
  ASSERT_TRUE(alloc.deallocate(100));
  ASSERT_FALSE(alloc.deallocate(100)); // double free
}

TEST_CASE(Allocator_Compaction_Eliminates_External_Fragmentation) {
  ContiguousAllocator alloc(1000, AllocationPolicy::FirstFit);

  // Allocate 5 contiguous blocks of 200
  alloc.allocate(1, 200); // 0-200
  alloc.allocate(2, 200); // 200-400
  alloc.allocate(3, 200); // 400-600
  alloc.allocate(4, 200); // 600-800
  alloc.allocate(5, 200); // 800-1000

  // Free blocks 2 and 4 (creating external fragmentation)
  alloc.deallocate(2);
  alloc.deallocate(4);

  auto m_before = alloc.compute_metrics();
  ASSERT_EQ(m_before.total_free, 400);
  ASSERT_EQ(m_before.largest_free_block, 200);
  ASSERT_EQ(m_before.external_fragmentation, 200);

  // Try allocating 350 -> should fail before compaction
  auto r_fail = alloc.allocate(6, 350);
  ASSERT_FALSE(r_fail.success);

  // Compact memory!
  std::size_t relocated = alloc.compact(100);
  ASSERT_EQ(relocated, 600); // Block 3 shifted 200B left, Block 5 shifted 400B left = 600B total shift distance

  auto m_after = alloc.compute_metrics();
  ASSERT_EQ(m_after.total_free, 400);
  ASSERT_EQ(m_after.largest_free_block, 400);
  ASSERT_EQ(m_after.external_fragmentation, 0); // Unified hole!

  // Now allocate 350 -> succeeds!
  auto r_ok = alloc.allocate(6, 350);
  ASSERT_TRUE(r_ok.success);
  ASSERT_EQ(r_ok.start_address, 600);
  ASSERT_EQ(alloc.total_free(), 50);
}

TEST_CASE(Allocator_Accounting_Invariants) {
  ContiguousAllocator alloc(1024, AllocationPolicy::BestFit);

  // Systematic sequence of operations
  std::vector<std::uint32_t> active_owners;

  for (std::uint32_t i = 1; i <= 10; ++i) {
    auto res = alloc.allocate(i, 50 + (i * 10));
    if (res.success) {
      active_owners.push_back(i);
    }
  }

  // Check invariants after allocations
  auto check_invariants = [&alloc]() {
    auto snap = alloc.snapshot();
    std::size_t running_offset = 0;
    std::size_t free_sum = 0;
    std::size_t alloc_sum = 0;

    for (std::size_t i = 0; i < snap.size(); ++i) {
      const auto& b = snap[i];
      ASSERT_EQ(b.start, running_offset);
      running_offset += b.size;

      if (b.allocated) {
        alloc_sum += b.size;
        ASSERT_TRUE(b.owner.has_value());
      } else {
        free_sum += b.size;
        // Verify no two adjacent unallocated blocks
        if (i + 1 < snap.size()) {
          ASSERT_TRUE(snap[i + 1].allocated);
        }
      }
    }
    ASSERT_EQ(running_offset, alloc.total_capacity());
    ASSERT_EQ(free_sum + alloc_sum, alloc.total_capacity());
    ASSERT_EQ(free_sum, alloc.total_free());
  };

  check_invariants();

  // Free every second active owner
  for (std::size_t i = 0; i < active_owners.size(); i += 2) {
    alloc.deallocate(active_owners[i]);
    check_invariants();
  }

  // Free remaining owners
  for (std::size_t i = 1; i < active_owners.size(); i += 2) {
    alloc.deallocate(active_owners[i]);
    check_invariants();
  }

  // All freed -> should be single block
  ASSERT_EQ(alloc.total_free(), 1024);
  ASSERT_EQ(alloc.snapshot().size(), 1);
}
