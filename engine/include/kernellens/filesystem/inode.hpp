#pragma once

#include "kernellens/core/types.hpp"
#include <cstdint>
#include <string>
#include <vector>
#include <optional>

namespace kernellens {

struct Inode {
  std::uint32_t inumber = 0;
  bool is_directory = false;
  std::size_t size_bytes = 0;
  std::uint32_t permissions = 0644;
  std::vector<std::uint32_t> direct_blocks;
  std::optional<std::uint32_t> indirect_block = std::nullopt;
  Tick ctime = 0;
  Tick mtime = 0;
};

struct DirectoryEntry {
  std::string name;
  std::uint32_t inumber = 0;
};

} // namespace kernellens
