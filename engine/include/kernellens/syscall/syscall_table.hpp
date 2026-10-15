#pragma once

#include "kernellens/core/types.hpp"
#include "kernellens/core/event_log.hpp"
#include "kernellens/syscall/context.hpp"
#include <cstdint>
#include <string>
#include <map>
#include <functional>
#include <optional>

namespace kernellens {

enum class SyscallNumber : std::uint32_t {
  SysExit = 1,
  SysFork = 2,
  SysRead = 3,
  SysWrite = 4,
  SysOpen = 5,
  SysClose = 6,
  SysGetPid = 7,
  SysPipe = 8,
  SysMqSend = 9,
  SysMqRecv = 10,
  SysShmGet = 11,
  SysShmAttach = 12,
  SysShmDetach = 13,
  SysYield = 14,
  SysSleep = 15
};

inline std::string to_string(SyscallNumber num) {
  switch (num) {
    case SyscallNumber::SysExit: return "SYS_EXIT";
    case SyscallNumber::SysFork: return "SYS_FORK";
    case SyscallNumber::SysRead: return "SYS_READ";
    case SyscallNumber::SysWrite: return "SYS_WRITE";
    case SyscallNumber::SysOpen: return "SYS_OPEN";
    case SyscallNumber::SysClose: return "SYS_CLOSE";
    case SyscallNumber::SysGetPid: return "SYS_GETPID";
    case SyscallNumber::SysPipe: return "SYS_PIPE";
    case SyscallNumber::SysMqSend: return "SYS_MQ_SEND";
    case SyscallNumber::SysMqRecv: return "SYS_MQ_RECV";
    case SyscallNumber::SysShmGet: return "SYS_SHM_GET";
    case SyscallNumber::SysShmAttach: return "SYS_SHM_ATTACH";
    case SyscallNumber::SysShmDetach: return "SYS_SHM_DETACH";
    case SyscallNumber::SysYield: return "SYS_YIELD";
    case SyscallNumber::SysSleep: return "SYS_SLEEP";
  }
  return "SYS_UNKNOWN";
}

struct SyscallResult {
  std::int64_t return_value = 0;
  int error_code = 0;
  Tick ticks_spent = 1;
  std::string message;

  bool is_success() const noexcept { return error_code == 0 && return_value >= 0; }
  std::string to_json() const;
};

struct SyscallMetrics {
  std::size_t total_invocations = 0;
  std::size_t successful_invocations = 0;
  std::size_t failed_invocations = 0;
  Tick total_kernel_ticks_spent = 0;
  std::map<std::string, std::size_t> call_counts;

  std::string to_json() const;
};

// Forward declaration
class IpcManager;
class InodeFileSystem;

class SyscallDispatcher {
public:
  explicit SyscallDispatcher(EventLog* log = nullptr, IpcManager* ipc = nullptr,
                             InodeFileSystem* fs = nullptr);

  // Invoke system call via trap dispatcher (Trap 0x80)
  SyscallResult invoke(ProcessExecutionContext& ctx, SyscallNumber num,
                       const std::vector<std::uint64_t>& args, Tick now = 0);

  SyscallMetrics compute_metrics() const;
  std::string to_json() const;

  void reset();

private:
  EventLog* log_ = nullptr;
  IpcManager* ipc_ = nullptr;
  InodeFileSystem* fs_ = nullptr;

  std::size_t total_invocations_ = 0;
  std::size_t successful_invocations_ = 0;
  std::size_t failed_invocations_ = 0;
  Tick total_kernel_ticks_ = 0;
  std::map<std::string, std::size_t> call_counts_;

  SyscallResult execute_kernel(ProcessExecutionContext& ctx, SyscallNumber num,
                               const std::vector<std::uint64_t>& args, Tick now);
};

} // namespace kernellens
