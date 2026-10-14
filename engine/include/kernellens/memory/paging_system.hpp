#pragma once

#include "kernellens/core/types.hpp"
#include "kernellens/core/event_log.hpp"
#include "kernellens/memory/page_replacer.hpp"
#include "kernellens/memory/tlb.hpp"
#include <memory>
#include <vector>

namespace kernellens {

struct PagingAccessResult {
  std::uint32_t page = 0;
  bool tlb_hit = false;
  bool page_fault = false;
  std::size_t frame_index = 0;
  std::optional<std::uint32_t> evicted_page = std::nullopt;
};

struct PagingMetrics {
  std::size_t total_accesses = 0;
  std::size_t page_faults = 0;
  std::size_t tlb_hits = 0;
  std::size_t tlb_misses = 0;
  double fault_rate = 0.0;
  double tlb_hit_rate = 0.0;

  std::string to_json() const;
};

class PagingSystem {
public:
  PagingSystem(std::size_t num_frames, std::unique_ptr<IPageReplacer> replacer,
               std::size_t tlb_capacity = 4, EventLog* log = nullptr);

  PagingAccessResult access(Tick now, std::uint32_t page, std::size_t ref_index,
                            const std::vector<std::uint32_t>& future_references);

  const std::vector<Frame>& frames() const noexcept { return frames_; }
  const TLB& tlb() const noexcept { return tlb_; }
  const PagingMetrics& metrics() const noexcept { return metrics_; }
  const IPageReplacer& replacer() const { return *replacer_; }

  void reset();

private:
  std::size_t num_frames_;
  std::unique_ptr<IPageReplacer> replacer_;
  TLB tlb_;
  EventLog* log_ = nullptr;
  std::vector<Frame> frames_;
  PagingMetrics metrics_;
};

} // namespace kernellens
