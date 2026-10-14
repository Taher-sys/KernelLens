#include "kernellens/memory/replacers.hpp"
#include <algorithm>
#include <limits>
#include <stdexcept>

namespace kernellens {

// -------------------------------------------------------------
// FIFO Replacer
// -------------------------------------------------------------
std::size_t FifoReplacer::choose_victim(const std::vector<Frame>& frames, const PageAccessContext& context) {
  (void)context;
  if (frames.empty()) {
    throw std::runtime_error("Frames collection is empty");
  }
  if (!load_order_.empty()) {
    std::size_t victim = load_order_.front();
    load_order_.pop_front();
    return victim;
  }
  // Fallback: earliest loaded_at
  std::size_t victim = 0;
  Tick min_loaded = frames[0].loaded_at;
  for (std::size_t i = 1; i < frames.size(); ++i) {
    if (frames[i].loaded_at < min_loaded) {
      min_loaded = frames[i].loaded_at;
      victim = i;
    }
  }
  return victim;
}

void FifoReplacer::on_hit(std::size_t frame_index, const PageAccessContext& context) {
  (void)frame_index;
  (void)context;
}

void FifoReplacer::on_load(std::size_t frame_index, std::uint32_t page, const PageAccessContext& context) {
  (void)page;
  (void)context;
  load_order_.push_back(frame_index);
}

void FifoReplacer::reset() {
  load_order_.clear();
}

// -------------------------------------------------------------
// LRU Replacer
// -------------------------------------------------------------
std::size_t LruReplacer::choose_victim(const std::vector<Frame>& frames, const PageAccessContext& context) {
  (void)context;
  if (frames.empty()) {
    throw std::runtime_error("Frames collection is empty");
  }
  std::size_t victim = 0;
  Tick min_last_used = frames[0].last_used_at;
  for (std::size_t i = 1; i < frames.size(); ++i) {
    if (frames[i].last_used_at < min_last_used) {
      min_last_used = frames[i].last_used_at;
      victim = i;
    }
  }
  return victim;
}

void LruReplacer::on_hit(std::size_t frame_index, const PageAccessContext& context) {
  (void)frame_index;
  (void)context;
}

void LruReplacer::on_load(std::size_t frame_index, std::uint32_t page, const PageAccessContext& context) {
  (void)frame_index;
  (void)page;
  (void)context;
}

void LruReplacer::reset() {}

// -------------------------------------------------------------
// Optimal (MIN) Replacer
// -------------------------------------------------------------
std::size_t OptimalReplacer::choose_victim(const std::vector<Frame>& frames, const PageAccessContext& context) {
  if (frames.empty()) {
    throw std::runtime_error("Frames collection is empty");
  }
  if (!context.future_references) {
    // Fallback to FIFO
    return 0;
  }

  const auto& refs = *context.future_references;
  std::size_t victim = 0;
  std::size_t max_next_use = 0;

  for (std::size_t i = 0; i < frames.size(); ++i) {
    if (!frames[i].page.has_value()) {
      return i; // Empty frame
    }

    std::uint32_t p = *frames[i].page;
    std::size_t next_use = std::numeric_limits<std::size_t>::max();

    for (std::size_t k = context.reference_index + 1; k < refs.size(); ++k) {
      if (refs[k] == p) {
        next_use = k;
        break;
      }
    }

    if (next_use == std::numeric_limits<std::size_t>::max()) {
      // Not referenced again in future trace
      return i;
    }

    if (next_use > max_next_use) {
      max_next_use = next_use;
      victim = i;
    }
  }

  return victim;
}

void OptimalReplacer::on_hit(std::size_t frame_index, const PageAccessContext& context) {
  (void)frame_index;
  (void)context;
}

void OptimalReplacer::on_load(std::size_t frame_index, std::uint32_t page, const PageAccessContext& context) {
  (void)frame_index;
  (void)page;
  (void)context;
}

void OptimalReplacer::reset() {}

// -------------------------------------------------------------
// Clock (Second-Chance) Replacer
// -------------------------------------------------------------
std::size_t ClockReplacer::choose_victim(const std::vector<Frame>& frames, const PageAccessContext& context) {
  (void)context;
  if (frames.empty()) {
    throw std::runtime_error("Frames collection is empty");
  }

  const std::size_t n = frames.size();
  // Traverse frames checking reference bits
  for (std::size_t count = 0; count < 2 * n; ++count) {
    std::size_t curr = hand_ % n;
    if (!frames[curr].reference_bit) {
      hand_ = (curr + 1) % n;
      return curr;
    }
    // Second chance given; bit will be cleared by caller/paging system
    hand_ = (curr + 1) % n;
  }

  std::size_t victim = hand_ % n;
  hand_ = (victim + 1) % n;
  return victim;
}

void ClockReplacer::on_hit(std::size_t frame_index, const PageAccessContext& context) {
  (void)frame_index;
  (void)context;
}

void ClockReplacer::on_load(std::size_t frame_index, std::uint32_t page, const PageAccessContext& context) {
  (void)frame_index;
  (void)page;
  (void)context;
}

void ClockReplacer::reset() {
  hand_ = 0;
}

} // namespace kernellens
