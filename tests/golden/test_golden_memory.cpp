#include "test_harness.hpp"
#include "kernellens/memory/replacers.hpp"
#include "kernellens/memory/paging_system.hpp"

using namespace kernellens;
using namespace kernellens::testing;

TEST_CASE(Golden_BeladyAnomaly_FIFO) {
  // Classic Belady's Anomaly reference string:
  // 1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5
  std::vector<std::uint32_t> refs = {1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5};

  // Run with 3 frames
  PagingSystem sys3(3, std::make_unique<FifoReplacer>(), 0);
  for (std::size_t i = 0; i < refs.size(); ++i) {
    sys3.access(i, refs[i], i, refs);
  }
  std::size_t faults_3 = sys3.metrics().page_faults;

  // Run with 4 frames
  PagingSystem sys4(4, std::make_unique<FifoReplacer>(), 0);
  for (std::size_t i = 0; i < refs.size(); ++i) {
    sys4.access(i, refs[i], i, refs);
  }
  std::size_t faults_4 = sys4.metrics().page_faults;

  // With 3 frames: exactly 9 page faults
  ASSERT_EQ(faults_3, 9);

  // With 4 frames: exactly 10 page faults
  ASSERT_EQ(faults_4, 10);

  // Proven Belady's anomaly: Increasing frames from 3 to 4 increased page faults from 9 to 10!
  ASSERT_TRUE(faults_4 > faults_3);
}

TEST_CASE(Golden_TextbookComparison_FIFO_LRU_Optimal) {
  // Standard Silberschatz textbook reference string:
  // 7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2, 1, 2, 0, 1, 7, 0, 1
  std::vector<std::uint32_t> refs = {
    7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2, 1, 2, 0, 1, 7, 0, 1
  };
  const std::size_t frames = 3;

  // 1. FIFO
  PagingSystem fifo_sys(frames, std::make_unique<FifoReplacer>(), 0);
  for (std::size_t i = 0; i < refs.size(); ++i) {
    fifo_sys.access(i, refs[i], i, refs);
  }
  ASSERT_EQ(fifo_sys.metrics().page_faults, 15);

  // 2. LRU
  PagingSystem lru_sys(frames, std::make_unique<LruReplacer>(), 0);
  for (std::size_t i = 0; i < refs.size(); ++i) {
    lru_sys.access(i, refs[i], i, refs);
  }
  ASSERT_EQ(lru_sys.metrics().page_faults, 12);

  // 3. Optimal (MIN)
  PagingSystem opt_sys(frames, std::make_unique<OptimalReplacer>(), 0);
  for (std::size_t i = 0; i < refs.size(); ++i) {
    opt_sys.access(i, refs[i], i, refs);
  }
  ASSERT_EQ(opt_sys.metrics().page_faults, 9);

  // Invariant: Optimal (9) <= LRU (12) <= FIFO (15)
  ASSERT_TRUE(opt_sys.metrics().page_faults <= lru_sys.metrics().page_faults);
  ASSERT_TRUE(lru_sys.metrics().page_faults <= fifo_sys.metrics().page_faults);
}
