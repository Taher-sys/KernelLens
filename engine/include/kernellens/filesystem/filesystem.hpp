#pragma once

#include "kernellens/filesystem/inode.hpp"
#include "kernellens/core/event_log.hpp"
#include <map>
#include <memory>
#include <string>
#include <vector>
#include <optional>

namespace kernellens {

struct FileSystemMetrics {
  std::size_t block_size = 512;
  std::size_t total_blocks = 256;
  std::size_t used_blocks = 0;
  std::size_t free_blocks = 256;
  std::size_t total_inodes = 0;
  std::size_t directory_count = 0;
  std::size_t file_count = 0;
  std::size_t total_data_bytes = 0;

  std::string to_json() const;
};

class InodeFileSystem {
public:
  explicit InodeFileSystem(std::size_t block_size = 512, std::size_t max_blocks = 256, EventLog* log = nullptr);

  bool create_directory(const std::string& path, std::uint32_t perms = 0755,
                        const UserContext& user = UserContext::root(),
                        std::optional<std::uint32_t> owner_uid = std::nullopt,
                        std::optional<std::uint32_t> owner_gid = std::nullopt,
                        Tick now = 0);

  bool create_file(const std::string& path, const std::string& content = "",
                   std::uint32_t perms = 0644,
                   FileAllocationStrategy strategy = FileAllocationStrategy::Indexed,
                   const UserContext& user = UserContext::root(),
                   std::optional<std::uint32_t> owner_uid = std::nullopt,
                   std::optional<std::uint32_t> owner_gid = std::nullopt,
                   Tick now = 0);

  std::optional<std::string> read_file(const std::string& path,
                                      const UserContext& user = UserContext::root()) const;

  bool write_file(const std::string& path, const std::string& content,
                  const UserContext& user = UserContext::root(), Tick now = 0);

  bool delete_file(const std::string& path,
                   const UserContext& user = UserContext::root(), Tick now = 0);

  bool remove_directory(const std::string& path,
                        const UserContext& user = UserContext::root(), Tick now = 0);

  std::vector<std::string> list_directory(const std::string& path,
                                         const UserContext& user = UserContext::root()) const;

  std::vector<DirectoryEntry> list_directory_entries(const std::string& path,
                                                     const UserContext& user = UserContext::root()) const;

  std::optional<Inode> get_inode(std::uint32_t inumber) const;
  std::optional<std::uint32_t> resolve_path(const std::string& path,
                                           const UserContext& user = UserContext::root(),
                                           bool check_exec = false) const;

  bool check_permission(const Inode& inode, const UserContext& user, FileAccessMode mode) const;

  // Capacity & disk metrics
  std::size_t total_inodes() const noexcept { return inodes_.size(); }
  std::size_t total_blocks_used() const noexcept { return block_pool_.size(); }
  std::size_t total_blocks_capacity() const noexcept { return max_blocks_; }
  std::size_t total_free_blocks() const noexcept {
    return (max_blocks_ > block_pool_.size()) ? (max_blocks_ - block_pool_.size()) : 0;
  }
  std::size_t block_size() const noexcept { return block_size_; }

  FileSystemMetrics compute_metrics() const;
  std::string to_json() const;
  std::string print_tree(const std::string& path = "/", int depth = 0) const;

  void reset();

private:
  std::size_t block_size_ = 512;
  std::size_t max_blocks_ = 256;
  EventLog* log_ = nullptr;
  std::uint32_t next_inumber_ = 1;

  std::map<std::uint32_t, Inode> inodes_;
  std::map<std::uint32_t, std::vector<DirectoryEntry>> directory_contents_;
  std::map<std::uint32_t, std::string> block_pool_;

  // Allocation strategies helpers
  bool allocate_contiguous(std::size_t num_blocks, std::vector<std::uint32_t>& out_blocks);
  bool allocate_linked(std::size_t num_blocks, std::vector<std::uint32_t>& out_chain);
  bool allocate_indexed(std::size_t num_blocks, std::vector<std::uint32_t>& out_direct,
                        std::optional<std::uint32_t>& out_indirect,
                        std::vector<std::uint32_t>& out_indirect_blocks);

  void free_inode_blocks(Inode& inode);

  std::vector<std::string> split_path(const std::string& path) const;
};

} // namespace kernellens
