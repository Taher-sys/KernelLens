#pragma once

#include "kernellens/memory/page_replacer.hpp"
#include <deque>

namespace kernellens {

class FifoReplacer : public IPageReplacer {
public:
  std::string name() const override { return "FIFO"; }
  std::size_t choose_victim(const std::vector<Frame>& frames, const PageAccessContext& context) override;
  void on_hit(std::size_t frame_index, const PageAccessContext& context) override;
  void on_load(std::size_t frame_index, std::uint32_t page, const PageAccessContext& context) override;
  void reset() override;

private:
  std::deque<std::size_t> load_order_;
};

class LruReplacer : public IPageReplacer {
public:
  std::string name() const override { return "LRU"; }
  std::size_t choose_victim(const std::vector<Frame>& frames, const PageAccessContext& context) override;
  void on_hit(std::size_t frame_index, const PageAccessContext& context) override;
  void on_load(std::size_t frame_index, std::uint32_t page, const PageAccessContext& context) override;
  void reset() override;
};

class OptimalReplacer : public IPageReplacer {
public:
  std::string name() const override { return "OPTIMAL"; }
  std::size_t choose_victim(const std::vector<Frame>& frames, const PageAccessContext& context) override;
  void on_hit(std::size_t frame_index, const PageAccessContext& context) override;
  void on_load(std::size_t frame_index, std::uint32_t page, const PageAccessContext& context) override;
  void reset() override;
};

class ClockReplacer : public IPageReplacer {
public:
  std::string name() const override { return "CLOCK"; }
  std::size_t choose_victim(const std::vector<Frame>& frames, const PageAccessContext& context) override;
  void on_hit(std::size_t frame_index, const PageAccessContext& context) override;
  void on_load(std::size_t frame_index, std::uint32_t page, const PageAccessContext& context) override;
  void reset() override;

private:
  std::size_t hand_ = 0;
};

} // namespace kernellens
