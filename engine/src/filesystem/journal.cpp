#include "kernellens/filesystem/journal.hpp"
#include <sstream>

namespace kernellens {

JournalingFileSystem::JournalingFileSystem(InodeFileSystem* fs, EventLog* log)
    : fs_(fs), log_(log) {}

std::uint64_t JournalingFileSystem::begin_transaction(const std::string& op, const std::string& path,
                                                      const std::string& data,
                                                      std::uint32_t perms,
                                                      FileAllocationStrategy strategy,
                                                      Tick now) {
  std::uint64_t tx_id = next_tx_id_++;
  journal_.push_back({tx_id, op, path, data, perms, strategy, TransactionState::Active});

  if (log_) {
    std::ostringstream ss;
    ss << "{\"txId\":" << tx_id << ",\"op\":\"" << op << "\",\"path\":\"" << path << "\"}";
    log_->emit("filesystem", "fs_transaction_started", std::nullopt, now, ss.str());
  }
  return tx_id;
}

bool JournalingFileSystem::commit_transaction(std::uint64_t tx_id, Tick now) {
  for (auto& record : journal_) {
    if (record.tx_id == tx_id) {
      record.state = TransactionState::Committed;
      if (log_) {
        std::ostringstream ss;
        ss << "{\"txId\":" << tx_id << ",\"status\":\"COMMITTED\"}";
        log_->emit("filesystem", "fs_log_written", std::nullopt, now, ss.str());
      }
      // Apply transaction to filesystem
      if (record.operation == "CREATE_FILE") {
        fs_->create_file(record.path, record.data, record.perms, record.strategy, UserContext::root(), now);
      } else if (record.operation == "CREATE_DIR") {
        fs_->create_directory(record.path, record.perms, UserContext::root(), now);
      } else if (record.operation == "DELETE_FILE") {
        fs_->delete_file(record.path, UserContext::root(), now);
      }
      return true;
    }
  }
  return false;
}

void JournalingFileSystem::inject_crash(CrashPoint point, std::uint64_t tx_id, Tick now) {
  if (log_) {
    std::ostringstream ss;
    ss << "{\"txId\":" << tx_id
       << ",\"point\":\"" << (point == CrashPoint::PreCommit ? "PRE_COMMIT" : "POST_COMMIT_PRE_APPLY") << "\"}";
    log_->emit("filesystem", "fs_crash_injected", std::nullopt, now, ss.str());
  }

  // Crash simulates an abrupt stop; if it's PreCommit, the transaction remains Active (uncommitted).
  // If it's PostCommitPreApply, we set state to Committed in the log, but don't apply it yet to filesystem.
  if (point == CrashPoint::PostCommitPreApply) {
    for (auto& r : journal_) {
      if (r.tx_id == tx_id) {
        r.state = TransactionState::Committed;
        break;
      }
    }
  }
}

RecoveryReport JournalingFileSystem::recover(Tick now) {
  RecoveryReport report;

  for (auto& r : journal_) {
    if (r.state == TransactionState::Committed) {
      // REDO: ensure changes are applied to filesystem
      if (r.operation == "CREATE_FILE") {
        fs_->create_file(r.path, r.data, r.perms, r.strategy, UserContext::root(), now);
      } else if (r.operation == "CREATE_DIR") {
        fs_->create_directory(r.path, r.perms, UserContext::root(), now);
      }
      report.redone_transactions++;
      report.redone_tx_ids.push_back(r.tx_id);
    } else if (r.state == TransactionState::Active) {
      // UNDO / Discard uncommitted transaction
      r.state = TransactionState::Aborted;
      report.discarded_transactions++;
      report.discarded_tx_ids.push_back(r.tx_id);
    }
  }

  std::ostringstream ss;
  ss << "Recovery complete. Redone committed transactions: " << report.redone_transactions
     << ", Discarded uncommitted transactions: " << report.discarded_transactions;
  report.explanation = ss.str();

  if (log_) {
    std::ostringstream lss;
    lss << "{\"redone\":" << report.redone_transactions
        << ",\"discarded\":" << report.discarded_transactions
        << ",\"status\":\"RECOVERED\"}";
    log_->emit("filesystem", "fs_recovery_completed", std::nullopt, now, lss.str());
  }

  return report;
}

std::string JournalRecord::to_json() const {
  std::ostringstream ss;
  ss << "{"
     << "\"txId\":" << tx_id << ","
     << "\"op\":\"" << operation << "\","
     << "\"path\":\"" << path << "\","
     << "\"state\":\"" << to_string(state) << "\","
     << "\"strategy\":\"" << to_string(strategy) << "\""
     << "}";
  return ss.str();
}

std::string RecoveryReport::to_json() const {
  std::ostringstream ss;
  ss << "{"
     << "\"redoneTransactions\":" << redone_transactions << ","
     << "\"discardedTransactions\":" << discarded_transactions << ","
     << "\"explanation\":\"" << explanation << "\","
     << "\"redoneTxIds\":[";
  for (std::size_t i = 0; i < redone_tx_ids.size(); ++i) {
    if (i > 0) ss << ",";
    ss << redone_tx_ids[i];
  }
  ss << "],\"discardedTxIds\":[";
  for (std::size_t i = 0; i < discarded_tx_ids.size(); ++i) {
    if (i > 0) ss << ",";
    ss << discarded_tx_ids[i];
  }
  ss << "]}";
  return ss.str();
}

std::string JournalingFileSystem::to_json() const {
  std::ostringstream ss;
  ss << "{\"schemaVersion\":1,\"subsystem\":\"journal\",\"records\":[";
  for (std::size_t i = 0; i < journal_.size(); ++i) {
    if (i > 0) ss << ",";
    ss << journal_[i].to_json();
  }
  ss << "]}";
  return ss.str();
}

} // namespace kernellens
