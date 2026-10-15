#include "test_harness.hpp"
#include "kernellens/memory/allocator.hpp"
#include "kernellens/core/comparator.hpp"

using namespace kernellens;
using namespace kernellens::testing;

TEST_CASE(Golden_Allocator_Textbook_Buddy_Sequence) {
  // Classic textbook example of Buddy System (Silberschatz / Tanenbaum):
  // Initial: 1024K free block at address 0.
  BuddyAllocator buddy(1024, 16);

  // 1. Request A: 100K -> rounded to 128K (Order 7) at address 0
  auto rA = buddy.allocate(1, 100);
  ASSERT_TRUE(rA.success);
  ASSERT_EQ(rA.start_address, 0);
  ASSERT_EQ(rA.allocated, 128);
  ASSERT_EQ(rA.internal_fragmentation, 28);

  // 2. Request B: 240K -> rounded to 256K (Order 8) at address 256
  auto rB = buddy.allocate(2, 240);
  ASSERT_TRUE(rB.success);
  ASSERT_EQ(rB.start_address, 256);
  ASSERT_EQ(rB.allocated, 256);
  ASSERT_EQ(rB.internal_fragmentation, 16);

  // 3. Request C: 64K -> exact 64K (Order 6) at address 128
  auto rC = buddy.allocate(3, 64);
  ASSERT_TRUE(rC.success);
  ASSERT_EQ(rC.start_address, 128);
  ASSERT_EQ(rC.allocated, 64);
  ASSERT_EQ(rC.internal_fragmentation, 0);

  // 4. Request D: 256K -> rounded to 256K (Order 8) at address 512
  auto rD = buddy.allocate(4, 256);
  ASSERT_TRUE(rD.success);
  ASSERT_EQ(rD.start_address, 512);
  ASSERT_EQ(rD.allocated, 256);

  // 5. Release B: 256K freed at address 256. (Cannot merge: buddy is [0, 256) which is occupied by A & C)
  ASSERT_TRUE(buddy.deallocate(2));
  auto snap_after_rel_B = buddy.snapshot();
  bool found_hole_256 = false;
  for (const auto& b : snap_after_rel_B) {
    if (!b.allocated && b.start == 256 && b.size == 256) found_hole_256 = true;
  }
  ASSERT_TRUE(found_hole_256);

  // 6. Request E: 120K -> rounded to 128K at address 256 (split from the 256K hole)
  auto rE = buddy.allocate(5, 120);
  ASSERT_TRUE(rE.success);
  ASSERT_EQ(rE.start_address, 256);
  ASSERT_EQ(rE.allocated, 128);

  // 7. Release A: 128K at address 0 freed.
  ASSERT_TRUE(buddy.deallocate(1));

  // 8. Release C: 64K at address 128 freed.
  // Address 128 has remaining 64K buddy at 192 -> merges into 128K at 128!
  // Then [0, 128) and [128, 256) are buddies -> merges into 256K at address 0!
  ASSERT_TRUE(buddy.deallocate(3));
  auto snap_after_rel_C = buddy.snapshot();
  bool found_merged_256_at_0 = false;
  for (const auto& b : snap_after_rel_C) {
    if (!b.allocated && b.start == 0 && b.size == 256) found_merged_256_at_0 = true;
  }
  ASSERT_TRUE(found_merged_256_at_0);

  // 9. Release E & D -> All blocks merge cleanly back to 1024K
  ASSERT_TRUE(buddy.deallocate(5));
  ASSERT_TRUE(buddy.deallocate(4));
  ASSERT_EQ(buddy.total_free(), 1024);
  ASSERT_EQ(buddy.snapshot().size(), 1);
  ASSERT_EQ(buddy.snapshot()[0].size, 1024);
}

TEST_CASE(Golden_Allocator_Comparison_Report_Structure) {
  std::size_t capacity = 1024;
  std::vector<AllocatorOp> ops = {
    {AllocatorOpKind::Allocate, 1, 100, std::nullopt},
    {AllocatorOpKind::Allocate, 2, 240, std::nullopt},
    {AllocatorOpKind::Allocate, 3, 64,  std::nullopt},
    {AllocatorOpKind::Allocate, 4, 256, std::nullopt},
    {AllocatorOpKind::Deallocate, 2, 0, std::nullopt},
    {AllocatorOpKind::Allocate, 5, 120, std::nullopt},
    {AllocatorOpKind::Allocate, 6, 300, std::nullopt},
    {AllocatorOpKind::Deallocate, 1, 0, std::nullopt},
    {AllocatorOpKind::Deallocate, 3, 0, std::nullopt},
    {AllocatorOpKind::Allocate, 7, 200, std::nullopt}
  };

  std::vector<std::string> policies = {"FIRST_FIT", "BEST_FIT", "WORST_FIT", "BUDDY"};
  auto report = ComparisonEngine::compare_allocator(capacity, ops, policies, "FIRST_FIT");

  ASSERT_EQ(report.baseline_policy, "FIRST_FIT");
  ASSERT_EQ(report.capacity, 1024);
  ASSERT_EQ(report.results.size(), 4);

  // Check JSON format
  std::string json_str = report.to_json();
  ASSERT_TRUE(json_str.find("\"schemaVersion\":1") != std::string::npos);
  ASSERT_TRUE(json_str.find("\"subsystem\":\"allocator\"") != std::string::npos);
  ASSERT_TRUE(json_str.find("\"FIRST_FIT\"") != std::string::npos);
  ASSERT_TRUE(json_str.find("\"BEST_FIT\"") != std::string::npos);
  ASSERT_TRUE(json_str.find("\"WORST_FIT\"") != std::string::npos);
  ASSERT_TRUE(json_str.find("\"BUDDY\"") != std::string::npos);

  // Check CSV format
  std::string csv_str = report.to_csv();
  ASSERT_TRUE(csv_str.find("rank,policy,successful_allocations,failed_allocations") != std::string::npos);
  ASSERT_TRUE(csv_str.find("BUDDY") != std::string::npos);

  // Check Table format
  std::string table_str = report.to_table();
  ASSERT_TRUE(table_str.find("KernelLens Memory Allocator Comparative Analysis") != std::string::npos);
  ASSERT_TRUE(table_str.find("Capacity: 1024 bytes") != std::string::npos);

  // Verify baseline deltas exist and baseline deltas are 0%
  for (const auto& r : report.results) {
    if (r.policy == "FIRST_FIT") {
      for (const auto& d : r.deltas) {
        ASSERT_NEAR(d.percent_change, 0.0, 0.001);
      }
    }
  }
}
