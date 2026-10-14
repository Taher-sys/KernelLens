#include "test_harness.hpp"
#include "kernellens/disk/schedulers.hpp"

using namespace kernellens;
using namespace kernellens::testing;

TEST_CASE(Golden_Disk_Textbook_FCFS_SSTF_LOOK) {
  // Standard Silberschatz textbook disk scheduling queue:
  // 98, 183, 37, 122, 14, 124, 65, 67
  // Initial head: 53, Max cylinder: 199
  std::vector<std::uint32_t> requests = {98, 183, 37, 122, 14, 124, 65, 67};
  const std::uint32_t initial_head = 53;
  const std::uint32_t max_cylinder = 199;

  // 1. FCFS
  DiskFcfsScheduler fcfs;
  auto res_fcfs = fcfs.schedule(initial_head, HeadDirection::Up, max_cylinder, requests);
  // Textbook seek distance: exactly 640 cylinders
  ASSERT_EQ(res_fcfs.total_seek_distance, 640);
  ASSERT_EQ(res_fcfs.service_order.size(), 8);

  // 2. SSTF
  DiskSstfScheduler sstf;
  auto res_sstf = sstf.schedule(initial_head, HeadDirection::Up, max_cylinder, requests);
  // Textbook seek distance: exactly 236 cylinders
  ASSERT_EQ(res_sstf.total_seek_distance, 236);

  // 3. LOOK (moving Up from 53)
  DiskLookScheduler look;
  auto res_look = look.schedule(initial_head, HeadDirection::Up, max_cylinder, requests);
  // Services 65, 67, 98, 122, 124, 183 (seek: 183 - 53 = 130), then reverses to 37, 14 (seek: 183 - 14 = 169)
  // Total seek: 130 + 169 = 299 cylinders
  ASSERT_EQ(res_look.total_seek_distance, 299);

  // Invariant: SSTF (236) < LOOK (299) < FCFS (640)
  ASSERT_TRUE(res_sstf.total_seek_distance < res_look.total_seek_distance);
  ASSERT_TRUE(res_look.total_seek_distance < res_fcfs.total_seek_distance);
}
