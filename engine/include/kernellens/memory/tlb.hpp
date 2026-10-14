#pragma once

#include "kernellens/core/types.hpp"
#include <cstdint>
#include <vector>
#include <optional>

namespace kernellens {

struct TLBEntry {
  std::uint32_t page = 0;
  std::size_t frame = 0;
  Tick last_access = 0;
};

class TLB {
public:
  explicit TLB(std::size_t capacity = 4) : capacity_(capacity) {}

  std::optional<std::size_t> lookup(std::uint32_t page, Tick now) {
    if (capacity_ == 0) return std::nullopt;
    for (auto& entry : entries_) {
      if (entry.page == page) {
        entry.last_access = now;
        hits_++;
        return entry.frame;
      }
    }
    misses_++;
    return std::nullopt;
  }

  void insert(std::uint32_t page, std::size_t frame, Tick now) {
    if (capacity_ == 0) return;
    for (auto& entry : entries_) {
      if (entry.page == page) {
        entry.frame = frame;
        entry.last_access = now;
        return;
      }
    }

    if (entries_.size() < capacity_) {
      entries_.push_back({page, frame, now});
      return;
    }

    // Evict LRU TLB entry
    std::size_t lru_idx = 0;
    Tick min_access = entries_[0].last_access;
    for (std::size_t i = 1; i < entries_.size(); ++i) {
      if (entries_[i].last_access < min_access) {
        min_access = entries_[i].last_access;
        lru_idx = i;
      }
    }
    entries_[lru_idx] = {page, frame, now};
  }

  void invalidate(std::uint32_t page) {
    for (auto it = entries_.begin(); it != entries_.end(); ++it) {
      if (it->page == page) {
        entries_.erase(it);
        break;
      }
    }
  }

  std::size_t hits() const noexcept { return hits_; }
  std::size_t misses() const noexcept { return misses_; }
  std::size_t capacity() const noexcept { return capacity_; }
  const std::vector<TLBEntry>& entries() const noexcept { return entries_; }

  double hit_ratio() const noexcept {
    std::size_t total = hits_ + misses_;
    return total == 0 ? 0.0 : static_cast<double>(hits_) / static_cast<double>(total);
  }

  void reset() {
    entries_.clear();
    hits_ = 0;
    misses_ = 0;
  }

private:
  std::size_t capacity_ = 4;
  std::vector<TLBEntry> entries_;
  std::size_t hits_ = 0;
  std::size_t misses_ = 0;
};

} // namespace kernellens
