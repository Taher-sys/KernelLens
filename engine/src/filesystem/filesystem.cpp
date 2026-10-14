#include "kernellens/filesystem/filesystem.hpp"
#include <sstream>
#include <algorithm>

namespace kernellens {

InodeFileSystem::InodeFileSystem(std::size_t block_size, EventLog* log)
    : block_size_(block_size), log_(log) {
  reset();
}

void InodeFileSystem::reset() {
  inodes_.clear();
  directory_contents_.clear();
  block_pool_.clear();
  next_inumber_ = 1;
  next_block_id_ = 1;

  // Root directory inode (inumber 1)
  std::uint32_t root_ino = next_inumber_++;
  Inode root;
  root.inumber = root_ino;
  root.is_directory = true;
  root.permissions = 0755;
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

std::optional<std::uint32_t> InodeFileSystem::resolve_path(const std::string& path) const {
  auto parts = split_path(path);
  if (parts.empty()) {
    return 1; // Root directory
  }

  std::uint32_t curr = 1;
  for (const auto& part : parts) {
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

bool InodeFileSystem::create_directory(const std::string& path, std::uint32_t perms, Tick now) {
  auto parts = split_path(path);
  if (parts.empty()) return false;

  std::string dir_name = parts.back();
  parts.pop_back();

  std::uint32_t parent_ino = 1;
  for (const auto& part : parts) {
    auto dir_it = directory_contents_.find(parent_ino);
    if (dir_it == directory_contents_.end()) return false;
    bool found = false;
    for (const auto& entry : dir_it->second) {
      if (entry.name == part) {
        parent_ino = entry.inumber;
        found = true;
        break;
      }
    }
    if (!found) return false;
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
  inode.ctime = now;
  inode.mtime = now;

  inodes_[new_ino] = inode;
  directory_contents_[new_ino] = {};
  directory_contents_[parent_ino].push_back({dir_name, new_ino});

  if (log_) {
    std::ostringstream ss;
    ss << "{\"path\":\"" << path << "\",\"inumber\":" << new_ino << ",\"isDir\":true}";
    log_->emit("filesystem", "fs_inode_created", std::nullopt, now, ss.str());
  }
  return true;
}

bool InodeFileSystem::create_file(const std::string& path, const std::string& content,
                                  std::uint32_t perms, Tick now) {
  auto parts = split_path(path);
  if (parts.empty()) return false;

  std::string file_name = parts.back();
  parts.pop_back();

  std::uint32_t parent_ino = 1;
  for (const auto& part : parts) {
    auto dir_it = directory_contents_.find(parent_ino);
    if (dir_it == directory_contents_.end()) return false;
    bool found = false;
    for (const auto& entry : dir_it->second) {
      if (entry.name == part) {
        parent_ino = entry.inumber;
        found = true;
        break;
      }
    }
    if (!found) return false;
  }

  // Check if file already exists
  for (const auto& entry : directory_contents_[parent_ino]) {
    if (entry.name == file_name) return false;
  }

  std::uint32_t new_ino = next_inumber_++;
  Inode inode;
  inode.inumber = new_ino;
  inode.is_directory = false;
  inode.permissions = perms;
  inode.size_bytes = content.size();
  inode.ctime = now;
  inode.mtime = now;

  // Allocate data blocks
  for (std::size_t offset = 0; offset < content.size(); offset += block_size_) {
    std::uint32_t blk_id = next_block_id_++;
    block_pool_[blk_id] = content.substr(offset, block_size_);
    inode.direct_blocks.push_back(blk_id);
  }

  inodes_[new_ino] = inode;
  directory_contents_[parent_ino].push_back({file_name, new_ino});

  if (log_) {
    std::ostringstream ss;
    ss << "{\"path\":\"" << path
       << "\",\"inumber\":" << new_ino
       << ",\"size\":" << content.size()
       << ",\"blocks\":" << inode.direct_blocks.size() << "}";
    log_->emit("filesystem", "fs_inode_created", std::nullopt, now, ss.str());
  }
  return true;
}

std::optional<std::string> InodeFileSystem::read_file(const std::string& path) const {
  auto ino_opt = resolve_path(path);
  if (!ino_opt.has_value()) return std::nullopt;

  auto inode = get_inode(*ino_opt);
  if (!inode.has_value() || inode->is_directory) return std::nullopt;

  std::string content;
  for (std::uint32_t blk_id : inode->direct_blocks) {
    auto it = block_pool_.find(blk_id);
    if (it != block_pool_.end()) {
      content += it->second;
    }
  }
  if (content.size() > inode->size_bytes) {
    content.resize(inode->size_bytes);
  }
  return content;
}

bool InodeFileSystem::write_file(const std::string& path, const std::string& content, Tick now) {
  auto ino_opt = resolve_path(path);
  if (!ino_opt.has_value()) return false;

  auto it = inodes_.find(*ino_opt);
  if (it == inodes_.end() || it->second.is_directory) return false;

  // Free existing blocks
  for (std::uint32_t blk_id : it->second.direct_blocks) {
    block_pool_.erase(blk_id);
  }
  it->second.direct_blocks.clear();

  // Reallocate
  it->second.size_bytes = content.size();
  it->second.mtime = now;
  for (std::size_t offset = 0; offset < content.size(); offset += block_size_) {
    std::uint32_t blk_id = next_block_id_++;
    block_pool_[blk_id] = content.substr(offset, block_size_);
    it->second.direct_blocks.push_back(blk_id);
  }
  return true;
}

bool InodeFileSystem::delete_file(const std::string& path, Tick now) {
  (void)now;
  auto parts = split_path(path);
  if (parts.empty()) return false;

  std::string file_name = parts.back();
  parts.pop_back();

  std::uint32_t parent_ino = 1;
  for (const auto& part : parts) {
    auto dir_it = directory_contents_.find(parent_ino);
    if (dir_it == directory_contents_.end()) return false;
    bool found = false;
    for (const auto& entry : dir_it->second) {
      if (entry.name == part) {
        parent_ino = entry.inumber;
        found = true;
        break;
      }
    }
    if (!found) return false;
  }

  auto& entries = directory_contents_[parent_ino];
  for (auto it = entries.begin(); it != entries.end(); ++it) {
    if (it->name == file_name) {
      std::uint32_t target_ino = it->inumber;
      entries.erase(it);

      auto inode_it = inodes_.find(target_ino);
      if (inode_it != inodes_.end()) {
        for (std::uint32_t blk_id : inode_it->second.direct_blocks) {
          block_pool_.erase(blk_id);
        }
        inodes_.erase(inode_it);
      }
      return true;
    }
  }
  return false;
}

std::vector<std::string> InodeFileSystem::list_directory(const std::string& path) const {
  auto ino_opt = resolve_path(path);
  if (!ino_opt.has_value()) return {};

  auto it = directory_contents_.find(*ino_opt);
  if (it == directory_contents_.end()) return {};

  std::vector<std::string> names;
  for (const auto& entry : it->second) {
    names.push_back(entry.name);
  }
  return names;
}

} // namespace kernellens
