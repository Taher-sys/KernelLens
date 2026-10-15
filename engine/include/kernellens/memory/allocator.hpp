#pragma once

#include "kernellens/core/types.hpp"
#include "kernellens/core/event_log.hpp"
#include <cstdint>
#include <vector>
#include <string>
#include <optional>

namespace kernellens {

struct MemoryBlock {
  std::uint32_t id = 0;
  std::size_t start = 0;
  std::size_t size = 0;
  bool allocated = false;
  std::optional<std::uint32_t> owner = std::nullopt;
  std::size_t requested_bytes = 0; // For internal fragmentation calculation
  std::uint32_t order = 0;          // For Buddy allocator: 2^order == size
};

struct MemoryMetrics {
  std::size_t total_capacity = 0;
  std::size_t total_allocated = 0;
  std::size_t total_free = 0;
  std::size_t largest_free_block = 0;
  std::size_t allocated_block_count = 0;
  std::size_t free_block_count = 0;
  std::size_t internal_fragmentation = 0;    // Bytes allocated beyond requested
  std::size_t external_fragmentation = 0;    // total_free - largest_free_block
  double external_fragmentation_ratio = 0.0; // external_frag / total_free
  double memory_utilization = 0.0;           // total_allocated / total_capacity

  std::string to_json() const;
};

struct AllocationResult {
  bool success = false;
  std::optional<std::uint32_t> block_id = std::nullopt;
  std::size_t start_address = 0;
  std::size_t requested = 0;
  std::size_t allocated = 0;
  std::size_t internal_fragmentation = 0;
  std::size_t external_fragmentation = 0;
  std::string reason;

  std::string to_json() const;
};

struct DeallocationResult {
  bool success = false;
  std::uint32_t owner = 0;
  std::optional<std::uint32_t> block_id = std::nullopt;
  std::size_t freed_bytes = 0;
  std::size_t merges_count = 0;
  std::string reason;

  std::string to_json() const;
};

enum class AllocationPolicy {
  FirstFit,
  BestFit,
  WorstFit,
  Buddy
};

inline std::string to_string(AllocationPolicy policy) {
  switch (policy) {
    case AllocationPolicy::FirstFit: return "FIRST_FIT";
    case AllocationPolicy::BestFit: return "BEST_FIT";
    case AllocationPolicy::WorstFit: return "WORST_FIT";
    case AllocationPolicy::Buddy: return "BUDDY";
  }
  return "UNKNOWN";
}

class IMemoryAllocator {
public:
  virtual ~IMemoryAllocator() = default;

  virtual std::string name() const = 0;
  virtual AllocationPolicy policy() const = 0;
  virtual AllocationResult allocate(std::uint32_t owner, std::size_t bytes, Tick now = 0) = 0;
  virtual bool deallocate(std::uint32_t owner, Tick now = 0) = 0;
  virtual DeallocationResult deallocate_by_id(std::uint32_t block_id, Tick now = 0) = 0;
  virtual std::vector<MemoryBlock> snapshot() const = 0;
  virtual std::size_t total_free() const = 0;
  virtual std::size_t total_capacity() const = 0;
  virtual MemoryMetrics compute_metrics() const = 0;
  virtual std::size_t compact(Tick now = 0) = 0;
  virtual void reset() = 0;
};

// -------------------------------------------------------------
// Contiguous Memory Allocator (First-Fit, Best-Fit, Worst-Fit)
// -------------------------------------------------------------
class ContiguousAllocator : public IMemoryAllocator {
public:
  ContiguousAllocator(std::size_t capacity, AllocationPolicy policy = AllocationPolicy::FirstFit,
                      EventLog* log = nullptr);

  std::string name() const override { return to_string(policy_); }
  AllocationPolicy policy() const override { return policy_; }
  AllocationResult allocate(std::uint32_t owner, std::size_t bytes, Tick now = 0) override;
  bool deallocate(std::uint32_t owner, Tick now = 0) override;
  DeallocationResult deallocate_by_id(std::uint32_t block_id, Tick now = 0) override;
  std::vector<MemoryBlock> snapshot() const override { return blocks_; }
  std::size_t total_free() const override;
  std::size_t total_capacity() const override { return capacity_; }
  MemoryMetrics compute_metrics() const override;
  std::size_t compact(Tick now = 0) override;
  void reset() override;

private:
  std::size_t capacity_;
  AllocationPolicy policy_;
  EventLog* log_ = nullptr;
  std::uint32_t next_block_id_ = 1;
  std::vector<MemoryBlock> blocks_;

  std::size_t coalesce();
};

// -------------------------------------------------------------
// Binary Buddy Memory Allocator (Power-of-Two Split & Merge)
// -------------------------------------------------------------
class BuddyAllocator : public IMemoryAllocator {
public:
  BuddyAllocator(std::size_t capacity, std::size_t min_block_size = 16,
                 EventLog* log = nullptr);

  std::string name() const override { return "BUDDY"; }
  AllocationPolicy policy() const override { return AllocationPolicy::Buddy; }
  AllocationResult allocate(std::uint32_t owner, std::size_t bytes, Tick now = 0) override;
  bool deallocate(std::uint32_t owner, Tick now = 0) override;
  DeallocationResult deallocate_by_id(std::uint32_t block_id, Tick now = 0) override;
  std::vector<MemoryBlock> snapshot() const override { return blocks_; }
  std::size_t total_free() const override;
  std::size_t total_capacity() const override { return capacity_; }
  MemoryMetrics compute_metrics() const override;
  std::size_t compact(Tick now = 0) override { (void)now; return 0; } // Buddy maintains alignment tree
  void reset() override;

  std::size_t min_block_size() const noexcept { return min_block_size_; }

private:
  std::size_t capacity_;
  std::size_t min_block_size_;
  EventLog* log_ = nullptr;
  std::uint32_t next_block_id_ = 1;
  std::vector<MemoryBlock> blocks_;

  static std::size_t next_power_of_two(std::size_t n);
  static std::uint32_t compute_order(std::size_t size);
  std::size_t coalesce_buddies(Tick now);
};

// -------------------------------------------------------------
// Allocator Operation & Workload Model
// -------------------------------------------------------------
enum class AllocatorOpKind {
  Allocate,
  Deallocate
};

struct AllocatorOp {
  AllocatorOpKind kind;
  std::uint32_t owner;
  std::size_t bytes = 0;
  std::optional<std::uint32_t> block_id = std::nullopt;
};

} // namespace kernellens
