#include "kernellens/memory/allocator.hpp"
#include <sstream>
#include <algorithm>

namespace kernellens {

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

void ContiguousAllocator::coalesce() {
  if (blocks_.size() <= 1) return;

  std::vector<MemoryBlock> coalesced;
  coalesced.push_back(blocks_[0]);

  for (std::size_t i = 1; i < blocks_.size(); ++i) {
    auto& prev = coalesced.back();
    const auto& curr = blocks_[i];

    if (!prev.allocated && !curr.allocated) {
      prev.size += curr.size;
    } else {
      coalesced.push_back(curr);
    }
  }

  blocks_ = std::move(coalesced);
}

AllocationResult ContiguousAllocator::allocate(std::uint32_t owner, std::size_t bytes, Tick now) {
  AllocationResult res;
  res.requested = bytes;

  if (bytes == 0) {
    res.success = false;
    res.reason = "Cannot allocate 0 bytes";
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
    res.success = true;
    res.block_id = candidate_it->id;
    res.allocated = bytes;
    res.reason = "Allocated successfully";

    // Split block if remaining slack > 0
    if (orig_size > bytes) {
      MemoryBlock remainder;
      remainder.id = next_block_id_++;
      remainder.start = start + bytes;
      remainder.size = orig_size - bytes;
      remainder.allocated = false;
      remainder.owner = std::nullopt;

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
  (void)now;
  bool found = false;
  for (auto& b : blocks_) {
    if (b.allocated && b.owner.has_value() && *b.owner == owner) {
      b.allocated = false;
      b.owner = std::nullopt;
      found = true;
    }
  }

  if (found) {
    coalesce();
  }
  return found;
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
  ss << "\"requested\":" << requested << ","
     << "\"allocated\":" << allocated << ","
     << "\"externalFragmentation\":" << external_fragmentation << ","
     << "\"reason\":\"" << reason << "\"}";
  return ss.str();
}

} // namespace kernellens
