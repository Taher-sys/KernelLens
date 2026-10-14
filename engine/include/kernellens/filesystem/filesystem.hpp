#pragma once

#include "kernellens/filesystem/inode.hpp"
#include "kernellens/core/event_log.hpp"
#include <map>
#include <memory>
#include <string>
#include <vector>

namespace kernellens {

class InodeFileSystem {
public:
  explicit InodeFileSystem(std::size_t block_size = 512, EventLog* log = nullptr);

  bool create_directory(const std::string& path, std::uint32_t perms = 0755, Tick now = 0);
  bool create_file(const std::string& path, const std::string& content = "",
                   std::uint32_t perms = 0644, Tick now = 0);
  std::optional<std::string> read_file(const std::string& path) const;
  bool write_file(const std::string& path, const std::string& content, Tick now = 0);
  bool delete_file(const std::string& path, Tick now = 0);
  std::vector<std::string> list_directory(const std::string& path) const;

  std::optional<Inode> get_inode(std::uint32_t inumber) const;
  std::optional<std::uint32_t> resolve_path(const std::string& path) const;

  std::size_t total_inodes() const noexcept { return inodes_.size(); }
  std::size_t total_blocks_used() const noexcept { return block_pool_.size(); }
  std::size_t block_size() const noexcept { return block_size_; }

  void reset();

private:
  std::size_t block_size_ = 512;
  EventLog* log_ = nullptr;
  std::uint32_t next_inumber_ = 1;
  std::uint32_t next_block_id_ = 1;

  std::map<std::uint32_t, Inode> inodes_;
  std::map<std::uint32_t, std::vector<DirectoryEntry>> directory_contents_;
  std::map<std::uint32_t, std::string> block_pool_;

  std::vector<std::string> split_path(const std::string& path) const;
};

} // namespace kernellens
