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
};

struct AllocationResult {
  bool success = false;
  std::optional<std::uint32_t> block_id = std::nullopt;
  std::size_t requested = 0;
  std::size_t allocated = 0;
  std::size_t external_fragmentation = 0;
  std::string reason;
  std::string to_json() const;
};

enum class AllocationPolicy {
  FirstFit,
  BestFit,
  WorstFit
};

inline std::string to_string(AllocationPolicy policy) {
  switch (policy) {
    case AllocationPolicy::FirstFit: return "FIRST_FIT";
    case AllocationPolicy::BestFit: return "BEST_FIT";
    case AllocationPolicy::WorstFit: return "WORST_FIT";
  }
  return "UNKNOWN";
}

class IMemoryAllocator {
public:
  virtual ~IMemoryAllocator() = default;

  virtual std::string name() const = 0;
  virtual AllocationResult allocate(std::uint32_t owner, std::size_t bytes, Tick now = 0) = 0;
  virtual bool deallocate(std::uint32_t owner, Tick now = 0) = 0;
  virtual std::vector<MemoryBlock> snapshot() const = 0;
  virtual std::size_t total_free() const = 0;
  virtual std::size_t total_capacity() const = 0;
  virtual void reset() = 0;
};

class ContiguousAllocator : public IMemoryAllocator {
public:
  ContiguousAllocator(std::size_t capacity, AllocationPolicy policy = AllocationPolicy::FirstFit,
                      EventLog* log = nullptr);

  std::string name() const override { return to_string(policy_); }
  AllocationResult allocate(std::uint32_t owner, std::size_t bytes, Tick now = 0) override;
  bool deallocate(std::uint32_t owner, Tick now = 0) override;
  std::vector<MemoryBlock> snapshot() const override { return blocks_; }
  std::size_t total_free() const override;
  std::size_t total_capacity() const override { return capacity_; }
  void reset() override;

private:
  std::size_t capacity_;
  AllocationPolicy policy_;
  EventLog* log_ = nullptr;
  std::uint32_t next_block_id_ = 1;
  std::vector<MemoryBlock> blocks_;

  void coalesce();
};

} // namespace kernellens
