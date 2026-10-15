#include "test_harness.hpp"
#include "kernellens/filesystem/filesystem.hpp"
#include "kernellens/filesystem/journal.hpp"

using namespace kernellens;
using namespace kernellens::testing;

TEST_CASE(Golden_Filesystem_Ext2_Structure_And_Json) {
  InodeFileSystem fs(512, 128);

  fs.create_directory("/bin", 0755);
  fs.create_directory("/etc", 0755);
  fs.create_directory("/home", 0755);
  fs.create_directory("/home/alice", 0700, UserContext::root(), 1001, 1001);

  fs.create_file("/etc/hostname", "kernellens-node-01\n", 0644);
  fs.create_file("/bin/sh", "SHELL_EXEC", 0755, FileAllocationStrategy::Contiguous);
  fs.create_file("/home/alice/.bashrc", "export PATH=/bin\n", 0644, FileAllocationStrategy::Indexed, UserContext::regular(1001, 1001));

  auto m = fs.compute_metrics();
  ASSERT_EQ(m.directory_count, 5); // /, /bin, /etc, /home, /home/alice
  ASSERT_EQ(m.file_count, 3);      // hostname, sh, .bashrc
  ASSERT_EQ(m.total_inodes, 8);
  ASSERT_TRUE(m.used_blocks >= 3);
  ASSERT_TRUE(m.free_blocks <= 125);

  std::string json_str = fs.to_json();
  ASSERT_TRUE(json_str.find("\"schemaVersion\":1") != std::string::npos);
  ASSERT_TRUE(json_str.find("\"subsystem\":\"filesystem\"") != std::string::npos);
  ASSERT_TRUE(json_str.find("\"directoryCount\":5") != std::string::npos);
  ASSERT_TRUE(json_str.find("\"fileCount\":3") != std::string::npos);

  std::string tree_str = fs.print_tree("/");
  ASSERT_TRUE(tree_str.find("[DIR]  /") != std::string::npos);
  ASSERT_TRUE(tree_str.find("bin/") != std::string::npos);
  ASSERT_TRUE(tree_str.find("etc/") != std::string::npos);
  ASSERT_TRUE(tree_str.find("hostname") != std::string::npos);
}

TEST_CASE(Golden_Filesystem_MultiLevel_Indirect_Indexed_Allocation) {
  // 512 bytes per block. MAX_DIRECT = 8 (4096 bytes).
  // A file of 6000 bytes requires 12 data blocks + 1 indirect block = 13 blocks.
  InodeFileSystem fs(512, 64);

  std::string large_content(6000, 'Z');
  ASSERT_TRUE(fs.create_file("/large_indexed.bin", large_content, 0644, FileAllocationStrategy::Indexed));

  auto ino_opt = fs.resolve_path("/large_indexed.bin");
  ASSERT_TRUE(ino_opt.has_value());
  auto ino = fs.get_inode(*ino_opt);
  ASSERT_TRUE(ino.has_value());

  ASSERT_EQ(ino->size_bytes, 6000);
  ASSERT_EQ(ino->direct_blocks.size(), 8); // 8 direct blocks
  ASSERT_TRUE(ino->indirect_block.has_value()); // 1 indirect block allocated!
  ASSERT_EQ(fs.total_blocks_used(), 13); // 12 data blocks + 1 index block

  // Verify byte-level readback matches 100%
  auto readback = fs.read_file("/large_indexed.bin");
  ASSERT_TRUE(readback.has_value());
  ASSERT_EQ(*readback, large_content);
}

TEST_CASE(Golden_Journal_CrashRecovery_Report_Schema) {
  InodeFileSystem fs(512, 64);
  JournalingFileSystem journal(&fs);

  std::uint64_t t1 = journal.begin_transaction("CREATE_FILE", "/commit.txt", "Data 1");
  journal.commit_transaction(t1);

  std::uint64_t t2 = journal.begin_transaction("CREATE_FILE", "/aborted.txt", "Data 2");
  journal.inject_crash(CrashPoint::PreCommit, t2);

  std::uint64_t t3 = journal.begin_transaction("CREATE_FILE", "/replay.txt", "Data 3");
  journal.inject_crash(CrashPoint::PostCommitPreApply, t3);

  auto rep = journal.recover();
  std::string rep_json = rep.to_json();
  ASSERT_TRUE(rep_json.find("\"redoneTransactions\":2") != std::string::npos);
  ASSERT_TRUE(rep_json.find("\"discardedTransactions\":1") != std::string::npos);
  ASSERT_TRUE(rep_json.find("\"explanation\":") != std::string::npos);

  std::string j_json = journal.to_json();
  ASSERT_TRUE(j_json.find("\"schemaVersion\":1") != std::string::npos);
  ASSERT_TRUE(j_json.find("\"subsystem\":\"journal\"") != std::string::npos);
}
