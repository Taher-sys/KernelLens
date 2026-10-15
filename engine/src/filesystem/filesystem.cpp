#include "kernellens/filesystem/filesystem.hpp"
#include <sstream>
#include <algorithm>
#include <iomanip>

namespace kernellens {

// ----------------------------------------------------------------------------
// JSON Serialization
// ----------------------------------------------------------------------------

std::string Inode::to_json() const {
  std::ostringstream ss;
  ss << "{"
     << "\"inumber\":" << inumber << ","
     << "\"isDirectory\":" << (is_directory ? "true" : "false") << ","
     << "\"sizeBytes\":" << size_bytes << ","
     << "\"permissions\":" << permissions << ","
     << "\"uid\":" << uid << ","
     << "\"gid\":" << gid << ","
     << "\"linkCount\":" << link_count << ","
     << "\"strategy\":\"" << to_string(strategy) << "\","
     << "\"directBlocks\":[";
  for (std::size_t i = 0; i < direct_blocks.size(); ++i) {
    if (i > 0) ss << ",";
    ss << direct_blocks[i];
  }
  ss << "],\"indirectBlock\":"
     << (indirect_block.has_value() ? std::to_string(*indirect_block) : "null") << ","
     << "\"indirectBlocks\":[";
  for (std::size_t i = 0; i < indirect_blocks.size(); ++i) {
    if (i > 0) ss << ",";
    ss << indirect_blocks[i];
  }
  ss << "],\"blockChain\":[";
  for (std::size_t i = 0; i < block_chain.size(); ++i) {
    if (i > 0) ss << ",";
    ss << block_chain[i];
  }
  ss << "]}";
  return ss.str();
}

std::string DirectoryEntry::to_json() const {
  std::ostringstream ss;
  ss << "{"
     << "\"name\":\"" << name << "\","
     << "\"inumber\":" << inumber << ","
     << "\"isDirectory\":" << (is_directory ? "true" : "false") << ","
     << "\"sizeBytes\":" << size_bytes
     << "}";
  return ss.str();
}

std::string FileSystemMetrics::to_json() const {
  std::ostringstream ss;
  ss << "{"
     << "\"blockSize\":" << block_size << ","
     << "\"totalBlocks\":" << total_blocks << ","
     << "\"usedBlocks\":" << used_blocks << ","
     << "\"freeBlocks\":" << free_blocks << ","
     << "\"totalInodes\":" << total_inodes << ","
     << "\"directoryCount\":" << directory_count << ","
     << "\"fileCount\":" << file_count << ","
     << "\"totalDataBytes\":" << total_data_bytes
     << "}";
  return ss.str();
}

// ----------------------------------------------------------------------------
// InodeFileSystem Implementation
// ----------------------------------------------------------------------------

InodeFileSystem::InodeFileSystem(std::size_t block_size, std::size_t max_blocks, EventLog* log)
    : block_size_(block_size), max_blocks_(max_blocks), log_(log) {
  reset();
}

void InodeFileSystem::reset() {
  inodes_.clear();
  directory_contents_.clear();
  block_pool_.clear();
  next_inumber_ = 1;

  // Root directory inode (inumber 1)
  std::uint32_t root_ino = next_inumber_++;
  Inode root;
  root.inumber = root_ino;
  root.is_directory = true;
  root.permissions = 0755;
  root.uid = 0;
  root.gid = 0;
  root.link_count = 2; // '.' and parent
  inodes_[root_ino] = root;
  directory_contents_[root_ino] = {};
}

std::vector<std::string> InodeFileSystem::split_path(const std::string& path) const {
  std::vector<std::string> parts;
  std::stringstream ss(path);
  std::string item;
  while (std::getline(ss, item, '/')) {
    if (!item.empty()) {
      parts.push_back(item);
    }
  }
  return parts;
}

bool InodeFileSystem::check_permission(const Inode& inode, const UserContext& user, FileAccessMode mode) const {
  if (user.is_root) return true;

  std::uint32_t mode_bit = static_cast<std::uint32_t>(mode);
  if (user.uid == inode.uid) {
    std::uint32_t owner_bits = (inode.permissions >> 6) & 07;
    return (owner_bits & mode_bit) != 0;
  }
  if (user.gid == inode.gid) {
    std::uint32_t group_bits = (inode.permissions >> 3) & 07;
    return (group_bits & mode_bit) != 0;
  }
  std::uint32_t others_bits = inode.permissions & 07;
  return (others_bits & mode_bit) != 0;
}

std::optional<std::uint32_t> InodeFileSystem::resolve_path(const std::string& path,
                                                          const UserContext& user,
                                                          bool check_exec) const {
  auto parts = split_path(path);
  if (parts.empty()) {
    return 1; // Root directory
  }

  std::uint32_t curr = 1;
  for (std::size_t i = 0; i < parts.size(); ++i) {
    const auto& part = parts[i];
    auto inode_it = inodes_.find(curr);
    if (inode_it == inodes_.end() || !inode_it->second.is_directory) {
      return std::nullopt;
    }

    if (check_exec && !check_permission(inode_it->second, user, FileAccessMode::Execute)) {
      return std::nullopt; // Execute permission denied on directory in path traversal
    }

    auto dir_it = directory_contents_.find(curr);
    if (dir_it == directory_contents_.end()) return std::nullopt;

    bool found = false;
    for (const auto& entry : dir_it->second) {
      if (entry.name == part) {
        curr = entry.inumber;
        found = true;
        break;
      }
    }
    if (!found) return std::nullopt;
  }
  return curr;
}

std::optional<Inode> InodeFileSystem::get_inode(std::uint32_t inumber) const {
  auto it = inodes_.find(inumber);
  if (it != inodes_.end()) return it->second;
  return std::nullopt;
}

// ----------------------------------------------------------------------------
// Allocation Strategy Helpers
// ----------------------------------------------------------------------------

bool InodeFileSystem::allocate_contiguous(std::size_t num_blocks, std::vector<std::uint32_t>& out_blocks) {
  if (num_blocks == 0) return true;
  if (num_blocks > total_free_blocks()) return false;

  // Find contiguous range of num_blocks in [1, max_blocks_]
  for (std::uint32_t start = 1; start + num_blocks - 1 <= max_blocks_; ++start) {
    bool span_free = true;
    for (std::uint32_t b = start; b < start + num_blocks; ++b) {
      if (block_pool_.find(b) != block_pool_.end()) {
        span_free = false;
        start = b; // skip ahead
        break;
      }
    }
    if (span_free) {
      out_blocks.clear();
      for (std::uint32_t b = start; b < start + num_blocks; ++b) {
        out_blocks.push_back(b);
      }
      return true;
    }
  }
  return false; // No contiguous span large enough
}

bool InodeFileSystem::allocate_linked(std::size_t num_blocks, std::vector<std::uint32_t>& out_chain) {
  if (num_blocks == 0) return true;
  if (num_blocks > total_free_blocks()) return false;

  out_chain.clear();
  for (std::uint32_t b = 1; b <= max_blocks_ && out_chain.size() < num_blocks; ++b) {
    if (block_pool_.find(b) == block_pool_.end()) {
      out_chain.push_back(b);
    }
  }
  return out_chain.size() == num_blocks;
}

bool InodeFileSystem::allocate_indexed(std::size_t num_blocks, std::vector<std::uint32_t>& out_direct,
                                      std::optional<std::uint32_t>& out_indirect,
                                      std::vector<std::uint32_t>& out_indirect_blocks) {
  const std::size_t MAX_DIRECT = 8;
  std::size_t total_needed = (num_blocks <= MAX_DIRECT) ? num_blocks : (num_blocks + 1);

  if (total_needed > total_free_blocks()) return false;

  std::vector<std::uint32_t> pool;
  for (std::uint32_t b = 1; b <= max_blocks_ && pool.size() < total_needed; ++b) {
    if (block_pool_.find(b) == block_pool_.end()) {
      pool.push_back(b);
    }
  }

  if (pool.size() < total_needed) return false;

  out_direct.clear();
  out_indirect_blocks.clear();
  std::size_t direct_count = std::min(num_blocks, MAX_DIRECT);
  for (std::size_t i = 0; i < direct_count; ++i) {
    out_direct.push_back(pool[i]);
  }

  if (num_blocks > MAX_DIRECT) {
    out_indirect = pool[direct_count];
    for (std::size_t i = direct_count + 1; i < total_needed; ++i) {
      out_indirect_blocks.push_back(pool[i]);
    }
  } else {
    out_indirect = std::nullopt;
  }

  return true;
}

void InodeFileSystem::free_inode_blocks(Inode& inode) {
  for (auto b : inode.direct_blocks) {
    block_pool_.erase(b);
  }
  if (inode.indirect_block.has_value()) {
    block_pool_.erase(*inode.indirect_block);
  }
  for (auto b : inode.indirect_blocks) {
    block_pool_.erase(b);
  }
  for (auto b : inode.block_chain) {
    block_pool_.erase(b);
  }
  inode.direct_blocks.clear();
  inode.indirect_block = std::nullopt;
  inode.indirect_blocks.clear();
  inode.block_chain.clear();
  inode.size_bytes = 0;
}

// ----------------------------------------------------------------------------
// File and Directory Operations
// ----------------------------------------------------------------------------

bool InodeFileSystem::create_directory(const std::string& path, std::uint32_t perms,
                                       const UserContext& user,
                                       std::optional<std::uint32_t> owner_uid,
                                       std::optional<std::uint32_t> owner_gid,
                                       Tick now) {
  auto parts = split_path(path);
  if (parts.empty()) return false;

  std::string dir_name = parts.back();
  parts.pop_back();

  std::string parent_path = "/";
  for (std::size_t i = 0; i < parts.size(); ++i) {
    if (i > 0) parent_path += "/";
    parent_path += parts[i];
  }

  auto parent_opt = resolve_path(parent_path, user, true);
  if (!parent_opt.has_value()) return false;
  std::uint32_t parent_ino = *parent_opt;

  const auto& parent_inode = inodes_[parent_ino];
  if (!check_permission(parent_inode, user, FileAccessMode::Write)) {
    return false; // Permission denied in parent directory
  }

  // Check if directory name already exists in parent
  for (const auto& entry : directory_contents_[parent_ino]) {
    if (entry.name == dir_name) return false;
  }

  std::uint32_t new_ino = next_inumber_++;
  Inode inode;
  inode.inumber = new_ino;
  inode.is_directory = true;
  inode.permissions = perms;
  inode.uid = owner_uid.value_or(user.uid);
  inode.gid = owner_gid.value_or(user.gid);
  inode.link_count = 2; // '.' and parent
  inode.ctime = now;
  inode.mtime = now;

  inodes_[new_ino] = inode;
  directory_contents_[new_ino] = {};

  directory_contents_[parent_ino].push_back({dir_name, new_ino, true, 0});
  inodes_[parent_ino].link_count++;

  if (log_) {
    std::ostringstream ss;
    ss << "{\"path\":\"" << path << "\",\"inumber\":" << new_ino << ",\"perms\":" << perms << "}";
    log_->emit("filesystem", "directory_created", std::nullopt, now, ss.str());
  }
  return true;
}

bool InodeFileSystem::create_file(const std::string& path, const std::string& content,
                                  std::uint32_t perms, FileAllocationStrategy strategy,
                                  const UserContext& user,
                                  std::optional<std::uint32_t> owner_uid,
                                  std::optional<std::uint32_t> owner_gid,
                                  Tick now) {
  auto parts = split_path(path);
  if (parts.empty()) return false;

  std::string file_name = parts.back();
  parts.pop_back();

  std::string parent_path = "/";
  for (std::size_t i = 0; i < parts.size(); ++i) {
    if (i > 0) parent_path += "/";
    parent_path += parts[i];
  }

  auto parent_opt = resolve_path(parent_path, user, true);
  if (!parent_opt.has_value()) return false;
  std::uint32_t parent_ino = *parent_opt;

  const auto& parent_inode = inodes_[parent_ino];
  if (!check_permission(parent_inode, user, FileAccessMode::Write)) {
    return false; // Permission denied in parent directory
  }

  // Duplicate check
  for (const auto& entry : directory_contents_[parent_ino]) {
    if (entry.name == file_name) return false;
  }

  // Calculate needed blocks
  std::size_t num_blocks = (content.empty()) ? 0 : ((content.size() + block_size_ - 1) / block_size_);

  std::vector<std::uint32_t> direct;
  std::optional<std::uint32_t> indirect = std::nullopt;
  std::vector<std::uint32_t> indirect_blocks;
  std::vector<std::uint32_t> chain;

  if (strategy == FileAllocationStrategy::Contiguous) {
    if (!allocate_contiguous(num_blocks, direct)) return false; // Storage exhausted or no contiguous hole
  } else if (strategy == FileAllocationStrategy::Linked) {
    if (!allocate_linked(num_blocks, chain)) return false;
  } else {
    if (!allocate_indexed(num_blocks, direct, indirect, indirect_blocks)) return false;
  }

  // Store data into blocks
  std::vector<std::uint32_t> all_data_blocks;
  if (strategy == FileAllocationStrategy::Linked) {
    all_data_blocks = chain;
  } else if (strategy == FileAllocationStrategy::Indexed) {
    all_data_blocks = direct;
    all_data_blocks.insert(all_data_blocks.end(), indirect_blocks.begin(), indirect_blocks.end());
  } else {
    all_data_blocks = direct;
  }

  for (std::size_t i = 0; i < all_data_blocks.size(); ++i) {
    std::size_t offset = i * block_size_;
    std::size_t len = std::min(block_size_, content.size() - offset);
    block_pool_[all_data_blocks[i]] = content.substr(offset, len);
  }

  if (indirect.has_value()) {
    block_pool_[*indirect] = "[INDEX_BLOCK]";
  }

  std::uint32_t new_ino = next_inumber_++;
  Inode inode;
  inode.inumber = new_ino;
  inode.is_directory = false;
  inode.size_bytes = content.size();
  inode.permissions = perms;
  inode.uid = owner_uid.value_or(user.uid);
  inode.gid = owner_gid.value_or(user.gid);
  inode.link_count = 1;
  inode.strategy = strategy;
  inode.direct_blocks = direct;
  inode.indirect_block = indirect;
  inode.indirect_blocks = indirect_blocks;
  inode.block_chain = chain;
  inode.ctime = now;
  inode.mtime = now;

  inodes_[new_ino] = inode;
  directory_contents_[parent_ino].push_back({file_name, new_ino, false, content.size()});

  if (log_) {
    std::ostringstream ss;
    ss << "{\"path\":\"" << path << "\",\"inumber\":" << new_ino
       << ",\"strategy\":\"" << to_string(strategy)
       << "\",\"size\":" << content.size()
       << ",\"blocks\":" << (all_data_blocks.size() + (indirect.has_value() ? 1 : 0)) << "}";
    log_->emit("filesystem", "file_created", std::nullopt, now, ss.str());
  }
  return true;
}

std::optional<std::string> InodeFileSystem::read_file(const std::string& path,
                                                     const UserContext& user) const {
  auto inumber_opt = resolve_path(path, user, true);
  if (!inumber_opt.has_value()) return std::nullopt;

  auto it = inodes_.find(*inumber_opt);
  if (it == inodes_.end() || it->second.is_directory) return std::nullopt;

  const auto& inode = it->second;
  if (!check_permission(inode, user, FileAccessMode::Read)) {
    return std::nullopt; // Read permission denied
  }

  std::string full_content;
  if (inode.strategy == FileAllocationStrategy::Linked) {
    for (auto b : inode.block_chain) {
      auto bit = block_pool_.find(b);
      if (bit != block_pool_.end()) full_content += bit->second;
    }
  } else if (inode.strategy == FileAllocationStrategy::Indexed) {
    for (auto b : inode.direct_blocks) {
      auto bit = block_pool_.find(b);
      if (bit != block_pool_.end()) full_content += bit->second;
    }
    for (auto b : inode.indirect_blocks) {
      auto bit = block_pool_.find(b);
      if (bit != block_pool_.end()) full_content += bit->second;
    }
  } else {
    for (auto b : inode.direct_blocks) {
      auto bit = block_pool_.find(b);
      if (bit != block_pool_.end()) full_content += bit->second;
    }
  }

  return full_content;
}

bool InodeFileSystem::write_file(const std::string& path, const std::string& content,
                                const UserContext& user, Tick now) {
  auto inumber_opt = resolve_path(path, user, true);
  if (!inumber_opt.has_value()) return false;

  auto it = inodes_.find(*inumber_opt);
  if (it == inodes_.end() || it->second.is_directory) return false;

  auto& inode = it->second;
  if (!check_permission(inode, user, FileAccessMode::Write)) {
    return false; // Write permission denied
  }

  // Free existing blocks
  free_inode_blocks(inode);

  // Allocate new blocks
  std::size_t num_blocks = (content.empty()) ? 0 : ((content.size() + block_size_ - 1) / block_size_);
  std::vector<std::uint32_t> direct;
  std::optional<std::uint32_t> indirect = std::nullopt;
  std::vector<std::uint32_t> indirect_blocks;
  std::vector<std::uint32_t> chain;

  if (inode.strategy == FileAllocationStrategy::Contiguous) {
    if (!allocate_contiguous(num_blocks, direct)) return false;
  } else if (inode.strategy == FileAllocationStrategy::Linked) {
    if (!allocate_linked(num_blocks, chain)) return false;
  } else {
    if (!allocate_indexed(num_blocks, direct, indirect, indirect_blocks)) return false;
  }

  std::vector<std::uint32_t> all_data_blocks;
  if (inode.strategy == FileAllocationStrategy::Linked) {
    all_data_blocks = chain;
  } else if (inode.strategy == FileAllocationStrategy::Indexed) {
    all_data_blocks = direct;
    all_data_blocks.insert(all_data_blocks.end(), indirect_blocks.begin(), indirect_blocks.end());
  } else {
    all_data_blocks = direct;
  }

  for (std::size_t i = 0; i < all_data_blocks.size(); ++i) {
    std::size_t offset = i * block_size_;
    std::size_t len = std::min(block_size_, content.size() - offset);
    block_pool_[all_data_blocks[i]] = content.substr(offset, len);
  }
  if (indirect.has_value()) {
    block_pool_[*indirect] = "[INDEX_BLOCK]";
  }

  inode.size_bytes = content.size();
  inode.direct_blocks = direct;
  inode.indirect_block = indirect;
  inode.indirect_blocks = indirect_blocks;
  inode.block_chain = chain;
  inode.mtime = now;

  // Update size in directory entry
  auto parts = split_path(path);
  std::string file_name = parts.back();
  parts.pop_back();
  std::string parent_path = "/";
  for (std::size_t i = 0; i < parts.size(); ++i) {
    if (i > 0) parent_path += "/";
    parent_path += parts[i];
  }
  auto parent_opt = resolve_path(parent_path, user, false);
  if (parent_opt.has_value()) {
    for (auto& entry : directory_contents_[*parent_opt]) {
      if (entry.name == file_name) {
        entry.size_bytes = content.size();
        break;
      }
    }
  }

  if (log_) {
    std::ostringstream ss;
    ss << "{\"path\":\"" << path << "\",\"inumber\":" << inode.inumber
       << ",\"newSize\":" << content.size() << "}";
    log_->emit("filesystem", "file_written", std::nullopt, now, ss.str());
  }
  return true;
}

bool InodeFileSystem::delete_file(const std::string& path, const UserContext& user, Tick now) {
  auto parts = split_path(path);
  if (parts.empty()) return false;

  std::string file_name = parts.back();
  parts.pop_back();

  std::string parent_path = "/";
  for (std::size_t i = 0; i < parts.size(); ++i) {
    if (i > 0) parent_path += "/";
    parent_path += parts[i];
  }

  auto parent_opt = resolve_path(parent_path, user, true);
  if (!parent_opt.has_value()) return false;
  std::uint32_t parent_ino = *parent_opt;

  const auto& parent_inode = inodes_[parent_ino];
  if (!check_permission(parent_inode, user, FileAccessMode::Write)) {
    return false; // Write permission denied on parent directory
  }

  auto& entries = directory_contents_[parent_ino];
  auto entry_it = std::find_if(entries.begin(), entries.end(),
                               [&](const DirectoryEntry& e) { return e.name == file_name; });
  if (entry_it == entries.end()) return false;

  std::uint32_t target_ino = entry_it->inumber;
  auto inode_it = inodes_.find(target_ino);
  if (inode_it == inodes_.end() || inode_it->second.is_directory) return false;

  free_inode_blocks(inode_it->second);
  inodes_.erase(inode_it);
  entries.erase(entry_it);

  if (log_) {
    std::ostringstream ss;
    ss << "{\"path\":\"" << path << "\",\"inumber\":" << target_ino << "}";
    log_->emit("filesystem", "file_deleted", std::nullopt, now, ss.str());
  }
  return true;
}

bool InodeFileSystem::remove_directory(const std::string& path, const UserContext& user, Tick now) {
  auto parts = split_path(path);
  if (parts.empty()) return false; // Cannot remove root

  std::string dir_name = parts.back();
  parts.pop_back();

  std::string parent_path = "/";
  for (std::size_t i = 0; i < parts.size(); ++i) {
    if (i > 0) parent_path += "/";
    parent_path += parts[i];
  }

  auto parent_opt = resolve_path(parent_path, user, true);
  if (!parent_opt.has_value()) return false;
  std::uint32_t parent_ino = *parent_opt;

  const auto& parent_inode = inodes_[parent_ino];
  if (!check_permission(parent_inode, user, FileAccessMode::Write)) {
    return false;
  }

  auto& entries = directory_contents_[parent_ino];
  auto entry_it = std::find_if(entries.begin(), entries.end(),
                               [&](const DirectoryEntry& e) { return e.name == dir_name; });
  if (entry_it == entries.end()) return false;

  std::uint32_t target_ino = entry_it->inumber;
  auto inode_it = inodes_.find(target_ino);
  if (inode_it == inodes_.end() || !inode_it->second.is_directory) return false;

  // Non-empty directory check
  if (!directory_contents_[target_ino].empty()) {
    return false; // Directory not empty
  }

  directory_contents_.erase(target_ino);
  inodes_.erase(inode_it);
  entries.erase(entry_it);
  inodes_[parent_ino].link_count--;

  if (log_) {
    std::ostringstream ss;
    ss << "{\"path\":\"" << path << "\",\"inumber\":" << target_ino << "}";
    log_->emit("filesystem", "directory_removed", std::nullopt, now, ss.str());
  }
  return true;
}

std::vector<std::string> InodeFileSystem::list_directory(const std::string& path,
                                                        const UserContext& user) const {
  std::vector<std::string> result;
  auto inumber_opt = resolve_path(path, user, true);
  if (!inumber_opt.has_value()) return result;

  auto it = inodes_.find(*inumber_opt);
  if (it == inodes_.end() || !it->second.is_directory) return result;

  if (!check_permission(it->second, user, FileAccessMode::Read)) {
    return result; // Read permission denied on directory
  }

  auto dir_it = directory_contents_.find(*inumber_opt);
  if (dir_it != directory_contents_.end()) {
    for (const auto& entry : dir_it->second) {
      result.push_back(entry.name);
    }
  }
  return result;
}

std::vector<DirectoryEntry> InodeFileSystem::list_directory_entries(const std::string& path,
                                                                   const UserContext& user) const {
  std::vector<DirectoryEntry> result;
  auto inumber_opt = resolve_path(path, user, true);
  if (!inumber_opt.has_value()) return result;

  auto it = inodes_.find(*inumber_opt);
  if (it == inodes_.end() || !it->second.is_directory) return result;

  if (!check_permission(it->second, user, FileAccessMode::Read)) {
    return result;
  }

  auto dir_it = directory_contents_.find(*inumber_opt);
  if (dir_it != directory_contents_.end()) {
    return dir_it->second;
  }
  return result;
}

FileSystemMetrics InodeFileSystem::compute_metrics() const {
  FileSystemMetrics m;
  m.block_size = block_size_;
  m.total_blocks = max_blocks_;
  m.used_blocks = block_pool_.size();
  m.free_blocks = total_free_blocks();
  m.total_inodes = inodes_.size();
  m.directory_count = 0;
  m.file_count = 0;
  m.total_data_bytes = 0;

  for (const auto& pair : inodes_) {
    if (pair.second.is_directory) {
      m.directory_count++;
    } else {
      m.file_count++;
      m.total_data_bytes += pair.second.size_bytes;
    }
  }
  return m;
}

std::string InodeFileSystem::to_json() const {
  auto m = compute_metrics();
  std::ostringstream ss;
  ss << "{"
     << "\"schemaVersion\":1,"
     << "\"subsystem\":\"filesystem\","
     << "\"metrics\":" << m.to_json() << ","
     << "\"inodes\":[";
  std::size_t count = 0;
  for (const auto& p : inodes_) {
    if (count > 0) ss << ",";
    ss << p.second.to_json();
    count++;
  }
  ss << "]}";
  return ss.str();
}

std::string InodeFileSystem::print_tree(const std::string& path, int depth) const {
  std::ostringstream ss;
  auto inumber_opt = resolve_path(path, UserContext::root(), false);
  if (!inumber_opt.has_value()) return "";

  auto it = inodes_.find(*inumber_opt);
  if (it == inodes_.end()) return "";

  std::string indent(depth * 2, ' ');
  std::string base_name = path;
  auto slash = path.find_last_of('/');
  if (slash != std::string::npos && slash + 1 < path.size()) {
    base_name = path.substr(slash + 1);
  }

  if (it->second.is_directory) {
    ss << indent << "[DIR]  " << base_name << "/ (ino " << it->second.inumber << ", "
       << std::oct << it->second.permissions << std::dec << ")\n";
    auto dir_it = directory_contents_.find(*inumber_opt);
    if (dir_it != directory_contents_.end()) {
      for (const auto& entry : dir_it->second) {
        std::string child_path = (path == "/") ? ("/" + entry.name) : (path + "/" + entry.name);
        ss << print_tree(child_path, depth + 1);
      }
    }
  } else {
    ss << indent << "[FILE] " << base_name << " (" << it->second.size_bytes << " B, ino "
       << it->second.inumber << ", " << to_string(it->second.strategy) << ")\n";
  }
  return ss.str();
}

} // namespace kernellens
