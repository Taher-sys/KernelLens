#include "test_harness.hpp"
#include "kernellens/filesystem/filesystem.hpp"
#include "kernellens/filesystem/journal.hpp"

using namespace kernellens;
using namespace kernellens::testing;

TEST_CASE(Filesystem_DirectoryAndFileOperations) {
  InodeFileSystem fs(512);

  ASSERT_TRUE(fs.create_directory("/home"));
  ASSERT_TRUE(fs.create_directory("/home/user"));
  ASSERT_TRUE(fs.create_file("/home/user/hello.txt", "Hello KernelLens Inode OS!"));

  // Verify directory listing
  auto entries = fs.list_directory("/home/user");
  ASSERT_EQ(entries.size(), 1);
  ASSERT_EQ(entries[0], "hello.txt");

  // Verify file content read
  auto content = fs.read_file("/home/user/hello.txt");
  ASSERT_TRUE(content.has_value());
  ASSERT_EQ(*content, "Hello KernelLens Inode OS!");

  // Overwrite file
  ASSERT_TRUE(fs.write_file("/home/user/hello.txt", "Updated content"));
  auto updated = fs.read_file("/home/user/hello.txt");
  ASSERT_EQ(*updated, "Updated content");

  // Delete file
  ASSERT_TRUE(fs.delete_file("/home/user/hello.txt"));
  ASSERT_FALSE(fs.read_file("/home/user/hello.txt").has_value());
}

TEST_CASE(Filesystem_AllocationStrategies_Contiguous_Linked_Indexed) {
  // 512 bytes per block, 64 blocks capacity
  InodeFileSystem fs(512, 64);

  std::string data_1200_bytes(1200, 'A'); // Requires 3 blocks (512 + 512 + 176)

  // 1. Contiguous allocation
  ASSERT_TRUE(fs.create_file("/file_contig.dat", data_1200_bytes, 0644, FileAllocationStrategy::Contiguous));
  auto ino_c_opt = fs.resolve_path("/file_contig.dat");
  ASSERT_TRUE(ino_c_opt.has_value());
  auto ino_c = fs.get_inode(*ino_c_opt);
  ASSERT_TRUE(ino_c.has_value());
  ASSERT_EQ(ino_c->direct_blocks.size(), 3);
  // Verify contiguous block IDs: b, b+1, b+2
  ASSERT_EQ(ino_c->direct_blocks[1], ino_c->direct_blocks[0] + 1);
  ASSERT_EQ(ino_c->direct_blocks[2], ino_c->direct_blocks[1] + 1);
  auto read_c = fs.read_file("/file_contig.dat");
  ASSERT_TRUE(read_c.has_value());
  ASSERT_EQ(*read_c, data_1200_bytes);

  // 2. Linked allocation
  ASSERT_TRUE(fs.create_file("/file_linked.dat", data_1200_bytes, 0644, FileAllocationStrategy::Linked));
  auto ino_l_opt = fs.resolve_path("/file_linked.dat");
  ASSERT_TRUE(ino_l_opt.has_value());
  auto ino_l = fs.get_inode(*ino_l_opt);
  ASSERT_TRUE(ino_l.has_value());
  ASSERT_EQ(ino_l->block_chain.size(), 3);
  auto read_l = fs.read_file("/file_linked.dat");
  ASSERT_TRUE(read_l.has_value());
  ASSERT_EQ(*read_l, data_1200_bytes);

  // 3. Indexed allocation
  ASSERT_TRUE(fs.create_file("/file_indexed.dat", data_1200_bytes, 0644, FileAllocationStrategy::Indexed));
  auto ino_i_opt = fs.resolve_path("/file_indexed.dat");
  ASSERT_TRUE(ino_i_opt.has_value());
  auto ino_i = fs.get_inode(*ino_i_opt);
  ASSERT_TRUE(ino_i.has_value());
  ASSERT_EQ(ino_i->direct_blocks.size(), 3);
  auto read_i = fs.read_file("/file_indexed.dat");
  ASSERT_TRUE(read_i.has_value());
  ASSERT_EQ(*read_i, data_1200_bytes);
}

TEST_CASE(Filesystem_StorageExhaustion_And_Rollback) {
  // Tiny filesystem of 5 blocks
  InodeFileSystem fs(512, 5);

  std::string data_2_blocks(1000, 'X'); // 2 blocks
  std::string data_4_blocks(2000, 'Y'); // 4 blocks

  ASSERT_TRUE(fs.create_file("/f1.dat", data_2_blocks));
  ASSERT_EQ(fs.total_blocks_used(), 2);
  ASSERT_EQ(fs.total_free_blocks(), 3);

  // Try to allocate 4 blocks when only 3 are free -> must fail cleanly
  ASSERT_FALSE(fs.create_file("/f2.dat", data_4_blocks));

  // Must not leak any blocks from the failed allocation
  ASSERT_EQ(fs.total_blocks_used(), 2);
  ASSERT_EQ(fs.total_free_blocks(), 3);
  ASSERT_FALSE(fs.resolve_path("/f2.dat").has_value());

  // Can still allocate 2 blocks
  ASSERT_TRUE(fs.create_file("/f3.dat", data_2_blocks));
  ASSERT_EQ(fs.total_blocks_used(), 4);
  ASSERT_EQ(fs.total_free_blocks(), 1);
}

TEST_CASE(Filesystem_Permissions_POSIX_Model) {
  InodeFileSystem fs(512, 64);

  UserContext root = UserContext::root();
  UserContext alice = UserContext::regular(1001, 1001);
  UserContext bob = UserContext::regular(1002, 1002);

  // Setup /home and /home/alice
  ASSERT_TRUE(fs.create_directory("/home", 0755, root));
  ASSERT_TRUE(fs.create_directory("/home/alice", 0700, root, alice.uid, alice.gid)); // rwx------ for alice only

  // Alice creates secret file with 0600 (rw-------)
  ASSERT_TRUE(fs.create_file("/home/alice/secret.txt", "AliceSecret", 0600,
                             FileAllocationStrategy::Indexed, alice));

  // 1. Alice can read and write her file
  auto a_read = fs.read_file("/home/alice/secret.txt", alice);
  ASSERT_TRUE(a_read.has_value());
  ASSERT_EQ(*a_read, "AliceSecret");
  ASSERT_TRUE(fs.write_file("/home/alice/secret.txt", "AliceSecretUpdated", alice));

  // 2. Bob cannot traverse /home/alice (0700 denied)
  auto b_read = fs.read_file("/home/alice/secret.txt", bob);
  ASSERT_FALSE(b_read.has_value());
  ASSERT_FALSE(fs.write_file("/home/alice/secret.txt", "Hacked", bob));
  ASSERT_FALSE(fs.delete_file("/home/alice/secret.txt", bob));

  // 3. Bob cannot list /home/alice
  auto b_list = fs.list_directory("/home/alice", bob);
  ASSERT_EQ(b_list.size(), 0);

  // 4. Root can read and write regardless of permissions
  auto r_read = fs.read_file("/home/alice/secret.txt", root);
  ASSERT_TRUE(r_read.has_value());
  ASSERT_EQ(*r_read, "AliceSecretUpdated");
}

TEST_CASE(Filesystem_DirectoryConstraints_And_Deletion) {
  InodeFileSystem fs(512, 32);

  ASSERT_TRUE(fs.create_directory("/dir1"));
  ASSERT_TRUE(fs.create_file("/dir1/file.txt", "sample"));

  // Duplicate creation rejected
  ASSERT_FALSE(fs.create_file("/dir1/file.txt", "duplicate"));
  ASSERT_FALSE(fs.create_directory("/dir1"));

  // Cannot remove non-empty directory
  ASSERT_FALSE(fs.remove_directory("/dir1"));

  // Cannot remove root
  ASSERT_FALSE(fs.remove_directory("/"));

  // Remove file, then directory removal succeeds
  ASSERT_TRUE(fs.delete_file("/dir1/file.txt"));
  ASSERT_TRUE(fs.remove_directory("/dir1"));
  ASSERT_FALSE(fs.resolve_path("/dir1").has_value());
}

TEST_CASE(Journaling_CrashRecovery_RedoAndUndo) {
  InodeFileSystem fs(512);
  JournalingFileSystem journal(&fs);

  // Transaction 1: Committed file creation
  std::uint64_t tx1 = journal.begin_transaction("CREATE_FILE", "/file1.txt", "Committed Data");
  ASSERT_TRUE(journal.commit_transaction(tx1));

  // Transaction 2: Crash before commit (PreCommit crash)
  std::uint64_t tx2 = journal.begin_transaction("CREATE_FILE", "/uncommitted.txt", "Lost Data");
  journal.inject_crash(CrashPoint::PreCommit, tx2);

  // Transaction 3: Crash after commit in log, but before filesystem write (PostCommitPreApply)
  std::uint64_t tx3 = journal.begin_transaction("CREATE_FILE", "/recovered.txt", "Recovered Data");
  journal.inject_crash(CrashPoint::PostCommitPreApply, tx3);

  // Run recovery
  auto report = journal.recover();

  // tx1 and tx3 should be redone/confirmed; tx2 should be discarded
  ASSERT_EQ(report.discarded_transactions, 1);
  ASSERT_TRUE(report.redone_transactions >= 1);

  // File from committed transaction 3 must exist after recovery
  auto recovered_content = fs.read_file("/recovered.txt");
  ASSERT_TRUE(recovered_content.has_value());
  ASSERT_EQ(*recovered_content, "Recovered Data");

  // File from uncommitted transaction 2 must NOT exist
  ASSERT_FALSE(fs.read_file("/uncommitted.txt").has_value());
}

TEST_CASE(Journaling_ComplexCrashScenario_MultipleTransactions) {
  InodeFileSystem fs(512, 64);
  JournalingFileSystem journal(&fs);

  // Tx 1: Committed dir
  std::uint64_t t1 = journal.begin_transaction("CREATE_DIR", "/data");
  ASSERT_TRUE(journal.commit_transaction(t1));

  // Tx 2: Committed file in /data
  std::uint64_t t2 = journal.begin_transaction("CREATE_FILE", "/data/f1.txt", "Payload 1");
  ASSERT_TRUE(journal.commit_transaction(t2));

  // Tx 3: PreCommit crash (aborted)
  std::uint64_t t3 = journal.begin_transaction("CREATE_FILE", "/data/f2_ghost.txt", "Ghost Payload");
  journal.inject_crash(CrashPoint::PreCommit, t3);

  // Tx 4: PostCommitPreApply crash (committed in log, needs replay)
  std::uint64_t t4 = journal.begin_transaction("CREATE_FILE", "/data/f3_replay.txt", "Replay Payload");
  journal.inject_crash(CrashPoint::PostCommitPreApply, t4);

  // Tx 5: Another uncommitted crash
  std::uint64_t t5 = journal.begin_transaction("CREATE_FILE", "/data/f4_lost.txt", "Lost Payload");
  journal.inject_crash(CrashPoint::PreCommit, t5);

  auto report = journal.recover();
  ASSERT_EQ(report.discarded_transactions, 2); // t3 and t5
  ASSERT_EQ(report.redone_transactions, 3);    // t1, t2, t4

  ASSERT_TRUE(fs.read_file("/data/f3_replay.txt").has_value());
  ASSERT_EQ(*fs.read_file("/data/f3_replay.txt"), "Replay Payload");
  ASSERT_FALSE(fs.read_file("/data/f2_ghost.txt").has_value());
  ASSERT_FALSE(fs.read_file("/data/f4_lost.txt").has_value());
}
