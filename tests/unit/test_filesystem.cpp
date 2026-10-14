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
