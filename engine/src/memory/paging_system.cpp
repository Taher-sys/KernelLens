#include "kernellens/memory/paging_system.hpp"
#include <sstream>
#include <iomanip>

namespace kernellens {

PagingSystem::PagingSystem(std::size_t num_frames, std::unique_ptr<IPageReplacer> replacer,
                           std::size_t tlb_capacity, EventLog* log)
    : num_frames_(num_frames), replacer_(std::move(replacer)),
      tlb_(tlb_capacity), log_(log), frames_(num_frames) {
  for (std::size_t i = 0; i < num_frames_; ++i) {
    frames_[i].frame_id = i;
  }
}

PagingAccessResult PagingSystem::access(Tick now, std::uint32_t page, std::size_t ref_index,
                                        const std::vector<std::uint32_t>& future_references) {
  metrics_.total_accesses++;
  PagingAccessResult res;
  res.page = page;

  PageAccessContext ctx{now, ref_index, &future_references};

  // 1. TLB Lookup
  auto tlb_lookup = tlb_.lookup(page, now);
  if (tlb_lookup.has_value()) {
    res.tlb_hit = true;
    metrics_.tlb_hits++;
    res.frame_index = *tlb_lookup;
    frames_[res.frame_index].last_used_at = now;
    frames_[res.frame_index].reference_bit = true;
    replacer_->on_hit(res.frame_index, ctx);

    if (log_) {
      std::ostringstream ss;
      ss << "{\"page\":" << page << ",\"frame\":" << res.frame_index << "}";
      log_->emit("memory", "tlb_hit", std::nullopt, now, ss.str());
    }
    return res;
  }

  // TLB Miss
  res.tlb_hit = false;
  metrics_.tlb_misses++;
  if (log_) {
    std::ostringstream ss;
    ss << "{\"page\":" << page << "}";
    log_->emit("memory", "tlb_miss", std::nullopt, now, ss.str());
  }

  // 2. Page Table / Frames check (Page Hit)
  for (std::size_t i = 0; i < frames_.size(); ++i) {
    if (frames_[i].page.has_value() && *frames_[i].page == page) {
      // Page hit in physical memory
      res.page_fault = false;
      res.frame_index = i;
      frames_[i].last_used_at = now;
      frames_[i].reference_bit = true;
      replacer_->on_hit(i, ctx);
      tlb_.insert(page, i, now);

      if (log_) {
        std::ostringstream ss;
        ss << "{\"page\":" << page << ",\"frame\":" << i << ",\"isHit\":true}";
        log_->emit("memory", "page_access", std::nullopt, now, ss.str());
      }
      return res;
    }
  }

  // 3. Page Fault
  res.page_fault = true;
  metrics_.page_faults++;

  // Check for free frame
  std::optional<std::size_t> free_frame_idx = std::nullopt;
  for (std::size_t i = 0; i < frames_.size(); ++i) {
    if (!frames_[i].page.has_value()) {
      free_frame_idx = i;
      break;
    }
  }

  std::size_t target_frame = 0;
  if (free_frame_idx.has_value()) {
    target_frame = *free_frame_idx;
  } else {
    // Choose victim frame
    target_frame = replacer_->choose_victim(frames_, ctx);
    res.evicted_page = frames_[target_frame].page;
    if (res.evicted_page.has_value()) {
      tlb_.invalidate(*res.evicted_page);
      if (log_) {
        std::ostringstream ss;
        ss << "{\"frame\":" << target_frame
           << ",\"evictedPage\":" << *res.evicted_page
           << ",\"policy\":\"" << replacer_->name() << "\"}";
        log_->emit("memory", "frame_evicted", std::nullopt, now, ss.str());
      }
    }
  }

  // Load new page into target frame
  frames_[target_frame].page = page;
  frames_[target_frame].loaded_at = now;
  frames_[target_frame].last_used_at = now;
  frames_[target_frame].reference_bit = true;
  res.frame_index = target_frame;

  replacer_->on_load(target_frame, page, ctx);
  tlb_.insert(page, target_frame, now);

  if (log_) {
    std::ostringstream fss;
    fss << "{\"page\":" << page
        << ",\"frame\":" << target_frame
        << ",\"policy\":\"" << replacer_->name() << "\"}";
    log_->emit("memory", "page_fault", std::nullopt, now, fss.str());

    std::ostringstream lss;
    lss << "{\"page\":" << page << ",\"frame\":" << target_frame << "}";
    log_->emit("memory", "frame_loaded", std::nullopt, now, lss.str());
  }

  // Update rates
  if (metrics_.total_accesses > 0) {
    metrics_.fault_rate = static_cast<double>(metrics_.page_faults) / static_cast<double>(metrics_.total_accesses);
    std::size_t tlb_tot = metrics_.tlb_hits + metrics_.tlb_misses;
    metrics_.tlb_hit_rate = tlb_tot == 0 ? 0.0 : static_cast<double>(metrics_.tlb_hits) / static_cast<double>(tlb_tot);
  }

  return res;
}

void PagingSystem::reset() {
  tlb_.reset();
  if (replacer_) {
    replacer_->reset();
  }
  for (std::size_t i = 0; i < frames_.size(); ++i) {
    frames_[i].page = std::nullopt;
    frames_[i].loaded_at = 0;
    frames_[i].last_used_at = 0;
    frames_[i].reference_bit = false;
  }
  metrics_ = PagingMetrics{};
}

std::string PagingMetrics::to_json() const {
  std::ostringstream ss;
  ss << std::fixed << std::setprecision(4);
  ss << "{"
     << "\"totalAccesses\":" << total_accesses << ","
     << "\"pageFaults\":" << page_faults << ","
     << "\"tlbHits\":" << tlb_hits << ","
     << "\"tlbMisses\":" << tlb_misses << ","
     << "\"faultRate\":" << fault_rate << ","
     << "\"tlbHitRate\":" << tlb_hit_rate
     << "}";
  return ss.str();
}

} // namespace kernellens
