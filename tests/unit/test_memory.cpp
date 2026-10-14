#include "test_harness.hpp"
#include "kernellens/memory/replacers.hpp"
#include "kernellens/memory/tlb.hpp"
#include "kernellens/memory/paging_system.hpp"

using namespace kernellens;
using namespace kernellens::testing;

TEST_CASE(TLB_HitAndMiss) {
  TLB tlb(2); // Capacity 2
  ASSERT_EQ(tlb.hits(), 0);
  ASSERT_EQ(tlb.misses(), 0);

  // Miss initially
  ASSERT_FALSE(tlb.lookup(10, 0).has_value());
  ASSERT_EQ(tlb.misses(), 1);

  // Insert page 10 in frame 1
  tlb.insert(10, 1, 1);

  // Hit on page 10
  auto hit = tlb.lookup(10, 2);
  ASSERT_TRUE(hit.has_value());
  ASSERT_EQ(*hit, 1);
  ASSERT_EQ(tlb.hits(), 1);

  // LRU eviction in TLB
  tlb.insert(20, 2, 3);
  tlb.insert(30, 0, 4); // Evicts page 10 because last_access of 10 was 2, while 20 was 3

  ASSERT_FALSE(tlb.lookup(10, 5).has_value()); // Page 10 evicted
  ASSERT_TRUE(tlb.lookup(30, 5).has_value());
}

TEST_CASE(Memory_ClockSecondChance) {
  PagingSystem sys(3, std::make_unique<ClockReplacer>(), 0); // Disable TLB to test replacement logic directly
  std::vector<std::uint32_t> refs = {1, 2, 3, 1, 4};

  for (std::size_t i = 0; i < refs.size(); ++i) {
    sys.access(i, refs[i], i, refs);
  }

  // 1, 2, 3 loaded -> frames [1, 2, 3] with ref_bit true
  // access 1 -> hit, ref_bit true
  // access 4 -> fault. Clock hand checks 1 (bit 1->0), checks 2 (bit 1->0), checks 3 (bit 1->0), wraps to 1 (bit 0 -> evicts 1) or evicts frame 1!
  ASSERT_EQ(sys.metrics().page_faults, 4); // 3 cold faults + 1 replacement fault
}
