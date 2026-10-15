#pragma once

#include "kernellens/core/types.hpp"
#include <cstdint>
#include <string>
#include <vector>
#include <optional>

namespace kernellens {

enum class FileAllocationStrategy {
  Contiguous,
  Linked,
  Indexed
};

inline std::string to_string(FileAllocationStrategy s) {
  switch (s) {
    case FileAllocationStrategy::Contiguous: return "CONTIGUOUS";
    case FileAllocationStrategy::Linked: return "LINKED";
    case FileAllocationStrategy::Indexed: return "INDEXED";
  }
  return "UNKNOWN";
}

enum class FileAccessMode {
  Read = 04,
  Write = 02,
  Execute = 01
};

struct UserContext {
  std::uint32_t uid = 0;
  std::uint32_t gid = 0;
  bool is_root = false;

  static UserContext root() { return {0, 0, true}; }
  static UserContext regular(std::uint32_t uid = 1000, std::uint32_t gid = 1000) {
    return {uid, gid, false};
  }
};

struct Inode {
  std::uint32_t inumber = 0;
  bool is_directory = false;
  std::size_t size_bytes = 0;
  std::uint32_t permissions = 0644;
  std::uint32_t uid = 0;
  std::uint32_t gid = 0;
  std::uint32_t link_count = 1;
  FileAllocationStrategy strategy = FileAllocationStrategy::Indexed;
  std::vector<std::uint32_t> direct_blocks;
  std::optional<std::uint32_t> indirect_block = std::nullopt;
  std::vector<std::uint32_t> indirect_blocks; // blocks pointed to by indirect_block
  std::vector<std::uint32_t> block_chain; // For linked allocation: chain of blocks
  Tick ctime = 0;
  Tick mtime = 0;

  std::string to_json() const;
};

struct DirectoryEntry {
  std::string name;
  std::uint32_t inumber = 0;
  bool is_directory = false;
  std::size_t size_bytes = 0;

  std::string to_json() const;
};

} // namespace kernellens
