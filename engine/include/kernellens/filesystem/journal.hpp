#pragma once

#include "kernellens/core/types.hpp"
#include "kernellens/core/event_log.hpp"
#include "kernellens/filesystem/filesystem.hpp"
#include <string>
#include <vector>

namespace kernellens {

enum class TransactionState {
  Active,
  Committed,
  Aborted
};

struct JournalRecord {
  std::uint64_t tx_id = 0;
  std::string operation;
  std::string path;
  std::string data;
  TransactionState state = TransactionState::Active;
};

enum class CrashPoint {
  PreCommit,          // Crash occurs before commit record is appended
  PostCommitPreApply  // Crash occurs after commit record is appended but before filesystem applied
};

struct RecoveryReport {
  std::size_t redone_transactions = 0;
  std::size_t discarded_transactions = 0;
  std::string explanation;
  std::string to_json() const;
};

class JournalingFileSystem {
public:
  JournalingFileSystem(InodeFileSystem* fs, EventLog* log = nullptr);

  std::uint64_t begin_transaction(const std::string& op, const std::string& path,
                                  const std::string& data = "", Tick now = 0);
  bool commit_transaction(std::uint64_t tx_id, Tick now = 0);
  void inject_crash(CrashPoint point, std::uint64_t tx_id, Tick now = 0);
  RecoveryReport recover(Tick now = 0);

  const std::vector<JournalRecord>& journal_records() const noexcept { return journal_; }

private:
  InodeFileSystem* fs_ = nullptr;
  EventLog* log_ = nullptr;
  std::uint64_t next_tx_id_ = 100;
  std::vector<JournalRecord> journal_;
};

} // namespace kernellens
