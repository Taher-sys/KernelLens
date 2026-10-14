#pragma once

#include "kernellens/core/types.hpp"
#include <cstdint>
#include <vector>
#include <optional>
#include <string>

namespace kernellens {

struct Frame {
  std::size_t frame_id = 0;
  std::optional<std::uint32_t> page = std::nullopt;
  Tick loaded_at = 0;
  Tick last_used_at = 0;
  bool reference_bit = false;
};

struct PageAccessContext {
  Tick time = 0;
  std::size_t reference_index = 0;
  const std::vector<std::uint32_t>* future_references = nullptr;
};

class IPageReplacer {
public:
  virtual ~IPageReplacer() = default;

  virtual std::string name() const = 0;
  virtual std::size_t choose_victim(const std::vector<Frame>& frames,
                                    const PageAccessContext& context) = 0;
  virtual void on_hit(std::size_t frame_index, const PageAccessContext& context) = 0;
  virtual void on_load(std::size_t frame_index, std::uint32_t page,
                       const PageAccessContext& context) = 0;
  virtual void reset() = 0;
};

} // namespace kernellens
