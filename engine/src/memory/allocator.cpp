#include "kernellens/memory/allocator.hpp"
#include <sstream>
#include <algorithm>
#include <iomanip>
#include <cmath>

namespace kernellens {

// ----------------------------------------------------------------------------
// JSON Serialization
// ----------------------------------------------------------------------------

std::string MemoryMetrics::to_json() const {
  std::ostringstream ss;
  ss << std::fixed << std::setprecision(4);
  ss << "{"
     << "\"totalCapacity\":" << total_capacity << ","
     << "\"totalAllocated\":" << total_allocated << ","
     << "\"totalFree\":" << total_free << ","
     << "\"largestFreeBlock\":" << largest_free_block << ","
     << "\"allocatedBlockCount\":" << allocated_block_count << ","
     << "\"freeBlockCount\":" << free_block_count << ","
     << "\"internalFragmentation\":" << internal_fragmentation << ","
     << "\"externalFragmentation\":" << external_fragmentation << ","
     << "\"externalFragmentationRatio\":" << external_fragmentation_ratio << ","
     << "\"memoryUtilization\":" << memory_utilization
     << "}";
  return ss.str();
}

std::string AllocationResult::to_json() const {
  std::ostringstream ss;
  ss << "{"
     << "\"success\":" << (success ? "true" : "false") << ",";
  if (block_id.has_value()) {
    ss << "\"blockId\":" << *block_id << ",";
  } else {
    ss << "\"blockId\":null,";
  }
  ss << "\"startAddress\":" << start_address << ","
     << "\"requested\":" << requested << ","
     << "\"allocated\":" << allocated << ","
     << "\"internalFragmentation\":" << internal_fragmentation << ","
     << "\"externalFragmentation\":" << external_fragmentation << ","
     << "\"reason\":\"" << reason << "\"}";
  return ss.str();
}

std::string DeallocationResult::to_json() const {
  std::ostringstream ss;
  ss << "{"
     << "\"success\":" << (success ? "true" : "false") << ","
     << "\"owner\":" << owner << ",";
  if (block_id.has_value()) {
    ss << "\"blockId\":" << *block_id << ",";
  } else {
    ss << "\"blockId\":null,";
  }
  ss << "\"freedBytes\":" << freed_bytes << ","
     << "\"mergesCount\":" << merges_count << ","
     << "\"reason\":\"" << reason << "\"}";
  return ss.str();
}

// ----------------------------------------------------------------------------
// Contiguous Allocator Implementation
// ----------------------------------------------------------------------------

ContiguousAllocator::ContiguousAllocator(std::size_t capacity, AllocationPolicy policy, EventLog* log)
    : capacity_(capacity), policy_(policy), log_(log) {
  reset();
}

void ContiguousAllocator::reset() {
  blocks_.clear();
  next_block_id_ = 1;
  MemoryBlock initial;
  initial.id = next_block_id_++;
  initial.start = 0;
  initial.size = capacity_;
  initial.allocated = false;
  initial.owner = std::nullopt;
  initial.requested_bytes = 0;
  initial.order = 0;
  blocks_.push_back(initial);
}

std::size_t ContiguousAllocator::total_free() const {
  std::size_t free_bytes = 0;
  for (const auto& b : blocks_) {
    if (!b.allocated) {
      free_bytes += b.size;
    }
  }
  return free_bytes;
}

MemoryMetrics ContiguousAllocator::compute_metrics() const {
  MemoryMetrics m;
  m.total_capacity = capacity_;
  m.total_allocated = 0;
  m.total_free = 0;
  m.largest_free_block = 0;
  m.allocated_block_count = 0;
  m.free_block_count = 0;
  m.internal_fragmentation = 0;

  for (const auto& b : blocks_) {
    if (b.allocated) {
      m.total_allocated += b.size;
      m.allocated_block_count++;
      if (b.size > b.requested_bytes) {
        m.internal_fragmentation += (b.size - b.requested_bytes);
      }
    } else {
      m.total_free += b.size;
      m.free_block_count++;
      if (b.size > m.largest_free_block) {
        m.largest_free_block = b.size;
      }
    }
  }

  m.external_fragmentation = (m.total_free >= m.largest_free_block)
                                 ? (m.total_free - m.largest_free_block)
                                 : 0;
  m.external_fragmentation_ratio = (m.total_free > 0)
                                       ? static_cast<double>(m.external_fragmentation) / static_cast<double>(m.total_free)
                                       : 0.0;
  m.memory_utilization = (capacity_ > 0)
                             ? static_cast<double>(m.total_allocated) / static_cast<double>(capacity_)
                             : 0.0;

  return m;
}

std::size_t ContiguousAllocator::coalesce() {
  if (blocks_.size() <= 1) return 0;

  std::size_t merges = 0;
  std::vector<MemoryBlock> coalesced;
  coalesced.push_back(blocks_[0]);

  for (std::size_t i = 1; i < blocks_.size(); ++i) {
    auto& prev = coalesced.back();
    const auto& curr = blocks_[i];

    if (!prev.allocated && !curr.allocated) {
      prev.size += curr.size;
      merges++;
    } else {
      coalesced.push_back(curr);
    }
  }

  blocks_ = std::move(coalesced);
  return merges;
}

AllocationResult ContiguousAllocator::allocate(std::uint32_t owner, std::size_t bytes, Tick now) {
  AllocationResult res;
  res.requested = bytes;

  if (bytes == 0) {
    res.success = false;
    res.reason = "Cannot allocate 0 bytes";
    return res;
  }

  if (bytes > capacity_) {
    res.success = false;
    res.allocated = 0;
    res.external_fragmentation = total_free();
    res.reason = "Requested size exceeds total memory capacity";
    if (log_) {
      std::ostringstream ss;
      ss << "{\"requested\":" << bytes << ",\"reason\":\"" << res.reason << "\"}";
      log_->emit("memory", "allocation_failed", owner, now, ss.str());
    }
    return res;
  }

  auto candidate_it = blocks_.end();

  if (policy_ == AllocationPolicy::FirstFit) {
    for (auto it = blocks_.begin(); it != blocks_.end(); ++it) {
      if (!it->allocated && it->size >= bytes) {
        candidate_it = it;
        break;
      }
    }
  } else if (policy_ == AllocationPolicy::BestFit) {
    std::size_t min_slack = capacity_ + 1;
    for (auto it = blocks_.begin(); it != blocks_.end(); ++it) {
      if (!it->allocated && it->size >= bytes) {
        std::size_t slack = it->size - bytes;
        if (slack < min_slack) {
          min_slack = slack;
          candidate_it = it;
        }
      }
    }
  } else if (policy_ == AllocationPolicy::WorstFit) {
    std::size_t max_slack = 0;
    for (auto it = blocks_.begin(); it != blocks_.end(); ++it) {
      if (!it->allocated && it->size >= bytes) {
        std::size_t slack = it->size - bytes;
        if (candidate_it == blocks_.end() || slack > max_slack) {
          max_slack = slack;
          candidate_it = it;
        }
      }
    }
  }

  if (candidate_it != blocks_.end()) {
    std::size_t orig_size = candidate_it->size;
    std::size_t start = candidate_it->start;

    candidate_it->allocated = true;
    candidate_it->owner = owner;
    candidate_it->size = bytes;
    candidate_it->requested_bytes = bytes;
    res.success = true;
    res.block_id = candidate_it->id;
    res.start_address = start;
    res.allocated = bytes;
    res.internal_fragmentation = 0;
    res.reason = "Allocated successfully";

    // Split block if remaining slack > 0
    if (orig_size > bytes) {
      MemoryBlock remainder;
      remainder.id = next_block_id_++;
      remainder.start = start + bytes;
      remainder.size = orig_size - bytes;
      remainder.allocated = false;
      remainder.owner = std::nullopt;
      remainder.requested_bytes = 0;
      remainder.order = 0;

      auto insert_pos = candidate_it + 1;
      blocks_.insert(insert_pos, remainder);
    }

    if (log_) {
      std::ostringstream ss;
      ss << "{\"bytes\":" << bytes
         << ",\"start\":" << start
         << ",\"blockId\":" << *res.block_id
         << ",\"policy\":\"" << to_string(policy_) << "\"}";
      log_->emit("memory", "allocation_succeeded", owner, now, ss.str());
    }
  } else {
    res.success = false;
    res.allocated = 0;
    std::size_t free_mem = total_free();
    res.external_fragmentation = free_mem;

    if (free_mem >= bytes) {
      res.reason = "Allocation failed due to external fragmentation (insufficient contiguous space)";
    } else {
      res.reason = "Allocation failed (out of total free memory)";
    }

    if (log_) {
      std::ostringstream ss;
      ss << "{\"requested\":" << bytes
         << ",\"totalFree\":" << free_mem
         << ",\"reason\":\"" << res.reason << "\"}";
      log_->emit("memory", "allocation_failed", owner, now, ss.str());
    }
  }

  return res;
}

bool ContiguousAllocator::deallocate(std::uint32_t owner, Tick now) {
  bool found = false;
  std::size_t freed_bytes = 0;

  for (auto& b : blocks_) {
    if (b.allocated && b.owner.has_value() && *b.owner == owner) {
      freed_bytes += b.size;
      b.allocated = false;
      b.owner = std::nullopt;
      b.requested_bytes = 0;
      found = true;
    }
  }

  if (found) {
    std::size_t merges = coalesce();
    if (log_) {
      std::ostringstream ss;
      ss << "{\"owner\":" << owner
         << ",\"freedBytes\":" << freed_bytes
         << ",\"mergesCount\":" << merges << "}";
      log_->emit("memory", "deallocation_succeeded", owner, now, ss.str());
    }
  } else if (log_) {
    std::ostringstream ss;
    ss << "{\"owner\":" << owner << ",\"reason\":\"Owner not found or already free\"}";
    log_->emit("memory", "deallocation_failed", owner, now, ss.str());
  }

  return found;
}

DeallocationResult ContiguousAllocator::deallocate_by_id(std::uint32_t block_id, Tick now) {
  DeallocationResult res;
  res.block_id = block_id;

  for (auto& b : blocks_) {
    if (b.id == block_id) {
      if (!b.allocated) {
        res.success = false;
        res.reason = "Block is already free (double free detected)";
        if (log_) {
          std::ostringstream ss;
          ss << "{\"blockId\":" << block_id << ",\"reason\":\"" << res.reason << "\"}";
          log_->emit("memory", "double_free_detected", std::nullopt, now, ss.str());
        }
        return res;
      }

      res.success = true;
      res.owner = b.owner.value_or(0);
      res.freed_bytes = b.size;
      b.allocated = false;
      b.owner = std::nullopt;
      b.requested_bytes = 0;

      res.merges_count = coalesce();
      res.reason = "Deallocated block successfully";

      if (log_) {
        std::ostringstream ss;
        ss << "{\"blockId\":" << block_id
           << ",\"freedBytes\":" << res.freed_bytes
           << ",\"mergesCount\":" << res.merges_count << "}";
        log_->emit("memory", "deallocation_succeeded", res.owner, now, ss.str());
      }
      return res;
    }
  }

  res.success = false;
  res.reason = "Block ID not found in memory map";
  return res;
}

std::size_t ContiguousAllocator::compact(Tick now) {
  std::size_t cur_start = 0;
  std::size_t bytes_shifted = 0;
  std::size_t blocks_moved = 0;

  std::vector<MemoryBlock> compacted;
  std::size_t total_alloc = 0;

  for (auto& b : blocks_) {
    if (b.allocated) {
      if (b.start != cur_start) {
        bytes_shifted += (b.start > cur_start) ? (b.start - cur_start) : 0;
        blocks_moved++;
        b.start = cur_start;
      }
      cur_start += b.size;
      total_alloc += b.size;
      compacted.push_back(b);
    }
  }

  // Create single free hole at the end
  if (cur_start < capacity_) {
    MemoryBlock free_hole;
    free_hole.id = next_block_id_++;
    free_hole.start = cur_start;
    free_hole.size = capacity_ - cur_start;
    free_hole.allocated = false;
    free_hole.owner = std::nullopt;
    free_hole.requested_bytes = 0;
    free_hole.order = 0;
    compacted.push_back(free_hole);
  }

  blocks_ = std::move(compacted);

  if (log_ && blocks_moved > 0) {
    std::ostringstream ss;
    ss << "{\"bytesShifted\":" << bytes_shifted
       << ",\"blocksMoved\":" << blocks_moved
       << ",\"newFreeStart\":" << cur_start << "}";
    log_->emit("memory", "compaction_completed", std::nullopt, now, ss.str());
  }

  return bytes_shifted;
}

// ----------------------------------------------------------------------------
// Buddy Allocator Implementation (Binary Buddy System)
// ----------------------------------------------------------------------------

std::size_t BuddyAllocator::next_power_of_two(std::size_t n) {
  if (n <= 1) return 1;
  std::size_t val = 1;
  while (val < n) {
    val <<= 1;
  }
  return val;
}

std::uint32_t BuddyAllocator::compute_order(std::size_t size) {
  std::uint32_t order = 0;
  while ((size >> 1) > 0) {
    size >>= 1;
    order++;
  }
  return order;
}

BuddyAllocator::BuddyAllocator(std::size_t capacity, std::size_t min_block_size, EventLog* log)
    : capacity_(next_power_of_two(std::max<std::size_t>(16, capacity))),
      min_block_size_(next_power_of_two(std::max<std::size_t>(4, min_block_size))),
      log_(log) {
  reset();
}

void BuddyAllocator::reset() {
  blocks_.clear();
  next_block_id_ = 1;
  MemoryBlock root;
  root.id = next_block_id_++;
  root.start = 0;
  root.size = capacity_;
  root.allocated = false;
  root.owner = std::nullopt;
  root.requested_bytes = 0;
  root.order = compute_order(capacity_);
  blocks_.push_back(root);
}

std::size_t BuddyAllocator::total_free() const {
  std::size_t free_mem = 0;
  for (const auto& b : blocks_) {
    if (!b.allocated) {
      free_mem += b.size;
    }
  }
  return free_mem;
}

MemoryMetrics BuddyAllocator::compute_metrics() const {
  MemoryMetrics m;
  m.total_capacity = capacity_;
  m.total_allocated = 0;
  m.total_free = 0;
  m.largest_free_block = 0;
  m.allocated_block_count = 0;
  m.free_block_count = 0;
  m.internal_fragmentation = 0;

  for (const auto& b : blocks_) {
    if (b.allocated) {
      m.total_allocated += b.size;
      m.allocated_block_count++;
      if (b.size > b.requested_bytes) {
        m.internal_fragmentation += (b.size - b.requested_bytes);
      }
    } else {
      m.total_free += b.size;
      m.free_block_count++;
      if (b.size > m.largest_free_block) {
        m.largest_free_block = b.size;
      }
    }
  }

  m.external_fragmentation = (m.total_free >= m.largest_free_block)
                                 ? (m.total_free - m.largest_free_block)
                                 : 0;
  m.external_fragmentation_ratio = (m.total_free > 0)
                                       ? static_cast<double>(m.external_fragmentation) / static_cast<double>(m.total_free)
                                       : 0.0;
  m.memory_utilization = (capacity_ > 0)
                             ? static_cast<double>(m.total_allocated) / static_cast<double>(capacity_)
                             : 0.0;

  return m;
}

AllocationResult BuddyAllocator::allocate(std::uint32_t owner, std::size_t bytes, Tick now) {
  AllocationResult res;
  res.requested = bytes;

  if (bytes == 0) {
    res.success = false;
    res.reason = "Cannot allocate 0 bytes";
    return res;
  }

  if (bytes > capacity_) {
    res.success = false;
    res.reason = "Requested size exceeds buddy total capacity";
    res.external_fragmentation = total_free();
    if (log_) {
      std::ostringstream ss;
      ss << "{\"requested\":" << bytes << ",\"reason\":\"" << res.reason << "\"}";
      log_->emit("memory", "allocation_failed", owner, now, ss.str());
    }
    return res;
  }

  std::size_t target_size = next_power_of_two(std::max(bytes, min_block_size_));

  // Find smallest free block with size >= target_size (Best Fit within Buddy)
  std::size_t best_idx = blocks_.size();
  std::size_t min_qualifying_size = capacity_ + 1;

  for (std::size_t i = 0; i < blocks_.size(); ++i) {
    if (!blocks_[i].allocated && blocks_[i].size >= target_size) {
      if (blocks_[i].size < min_qualifying_size) {
        min_qualifying_size = blocks_[i].size;
        best_idx = i;
      }
    }
  }

  if (best_idx == blocks_.size()) {
    res.success = false;
    res.allocated = 0;
    std::size_t free_mem = total_free();
    res.external_fragmentation = free_mem;
    if (free_mem >= target_size) {
      res.reason = "Allocation failed due to external fragmentation (no free buddy of sufficient order)";
    } else {
      res.reason = "Allocation failed (out of total free memory)";
    }
    if (log_) {
      std::ostringstream ss;
      ss << "{\"requested\":" << bytes
         << ",\"targetSize\":" << target_size
         << ",\"totalFree\":" << free_mem
         << ",\"reason\":\"" << res.reason << "\"}";
      log_->emit("memory", "allocation_failed", owner, now, ss.str());
    }
    return res;
  }

  // Progressively split down to target_size
  while (blocks_[best_idx].size > target_size) {
    MemoryBlock parent = blocks_[best_idx];
    std::size_t half_size = parent.size / 2;
    std::uint32_t new_order = parent.order - 1;

    MemoryBlock left;
    left.id = next_block_id_++;
    left.start = parent.start;
    left.size = half_size;
    left.allocated = false;
    left.owner = std::nullopt;
    left.requested_bytes = 0;
    left.order = new_order;

    MemoryBlock right;
    right.id = next_block_id_++;
    right.start = parent.start + half_size;
    right.size = half_size;
    right.allocated = false;
    right.owner = std::nullopt;
    right.requested_bytes = 0;
    right.order = new_order;

    // Replace parent with left, insert right
    blocks_[best_idx] = left;
    blocks_.insert(blocks_.begin() + best_idx + 1, right);

    if (log_) {
      std::ostringstream ss;
      ss << "{\"splitBlockStart\":" << parent.start
         << ",\"parentSize\":" << parent.size
         << ",\"halfSize\":" << half_size
         << ",\"newOrder\":" << new_order << "}";
      log_->emit("memory", "block_split", owner, now, ss.str());
    }
  }

  // Allocate selected block
  auto& chosen = blocks_[best_idx];
  chosen.allocated = true;
  chosen.owner = owner;
  chosen.requested_bytes = bytes;

  res.success = true;
  res.block_id = chosen.id;
  res.start_address = chosen.start;
  res.requested = bytes;
  res.allocated = chosen.size;
  res.internal_fragmentation = chosen.size - bytes;
  res.reason = "Allocated successfully via Buddy system";

  if (log_) {
    std::ostringstream ss;
    ss << "{\"bytes\":" << bytes
       << ",\"allocatedSize\":" << chosen.size
       << ",\"internalFrag\":" << res.internal_fragmentation
       << ",\"start\":" << chosen.start
       << ",\"order\":" << chosen.order << "}";
    log_->emit("memory", "allocation_succeeded", owner, now, ss.str());
  }

  return res;
}

std::size_t BuddyAllocator::coalesce_buddies(Tick now) {
  std::size_t total_merges = 0;
  bool merged_any = true;

  while (merged_any) {
    merged_any = false;
    // Sort blocks by start address to maintain canonical tree order
    std::sort(blocks_.begin(), blocks_.end(), [](const MemoryBlock& a, const MemoryBlock& b) {
      return a.start < b.start;
    });

    for (std::size_t i = 0; i + 1 < blocks_.size(); ++i) {
      auto& left = blocks_[i];
      auto& right = blocks_[i + 1];

      if (!left.allocated && !right.allocated &&
          left.size == right.size && left.order == right.order) {
        std::size_t buddy_size = left.size;
        // Verify buddy pairing alignment: left buddy must start at a multiple of 2 * size
        if ((left.start % (2 * buddy_size) == 0) &&
            (right.start == left.start + buddy_size)) {

          MemoryBlock parent;
          parent.id = next_block_id_++;
          parent.start = left.start;
          parent.size = 2 * buddy_size;
          parent.allocated = false;
          parent.owner = std::nullopt;
          parent.requested_bytes = 0;
          parent.order = left.order + 1;

          if (log_) {
            std::ostringstream ss;
            ss << "{\"mergedStart\":" << parent.start
               << ",\"mergedSize\":" << parent.size
               << ",\"newOrder\":" << parent.order << "}";
            log_->emit("memory", "buddy_merged", std::nullopt, now, ss.str());
          }

          blocks_[i] = parent;
          blocks_.erase(blocks_.begin() + i + 1);
          total_merges++;
          merged_any = true;
          break; // Restart scan after vector mutation
        }
      }
    }
  }

  return total_merges;
}

bool BuddyAllocator::deallocate(std::uint32_t owner, Tick now) {
  bool found = false;
  std::size_t freed_bytes = 0;

  for (auto& b : blocks_) {
    if (b.allocated && b.owner.has_value() && *b.owner == owner) {
      freed_bytes += b.size;
      b.allocated = false;
      b.owner = std::nullopt;
      b.requested_bytes = 0;
      found = true;
    }
  }

  if (found) {
    std::size_t merges = coalesce_buddies(now);
    if (log_) {
      std::ostringstream ss;
      ss << "{\"owner\":" << owner
         << ",\"freedBytes\":" << freed_bytes
         << ",\"mergesCount\":" << merges << "}";
      log_->emit("memory", "deallocation_succeeded", owner, now, ss.str());
    }
  } else if (log_) {
    std::ostringstream ss;
    ss << "{\"owner\":" << owner << ",\"reason\":\"Owner not found or already free\"}";
    log_->emit("memory", "deallocation_failed", owner, now, ss.str());
  }

  return found;
}

DeallocationResult BuddyAllocator::deallocate_by_id(std::uint32_t block_id, Tick now) {
  DeallocationResult res;
  res.block_id = block_id;

  for (auto& b : blocks_) {
    if (b.id == block_id) {
      if (!b.allocated) {
        res.success = false;
        res.reason = "Block is already free (double free detected)";
        if (log_) {
          std::ostringstream ss;
          ss << "{\"blockId\":" << block_id << ",\"reason\":\"" << res.reason << "\"}";
          log_->emit("memory", "double_free_detected", std::nullopt, now, ss.str());
        }
        return res;
      }

      res.success = true;
      res.owner = b.owner.value_or(0);
      res.freed_bytes = b.size;
      b.allocated = false;
      b.owner = std::nullopt;
      b.requested_bytes = 0;

      res.merges_count = coalesce_buddies(now);
      res.reason = "Deallocated and coalesced buddies successfully";

      if (log_) {
        std::ostringstream ss;
        ss << "{\"blockId\":" << block_id
           << ",\"freedBytes\":" << res.freed_bytes
           << ",\"mergesCount\":" << res.merges_count << "}";
        log_->emit("memory", "deallocation_succeeded", res.owner, now, ss.str());
      }
      return res;
    }
  }

  res.success = false;
  res.reason = "Block ID not found in buddy memory map";
  return res;
}

} // namespace kernellens
