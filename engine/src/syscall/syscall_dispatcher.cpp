#include "kernellens/syscall/syscall_table.hpp"
#include "kernellens/ipc/ipc_manager.hpp"
#include "kernellens/filesystem/filesystem.hpp"
#include <sstream>

namespace kernellens {

SyscallDispatcher::SyscallDispatcher(EventLog* log, IpcManager* ipc, InodeFileSystem* fs)
    : log_(log), ipc_(ipc), fs_(fs) {}

SyscallResult SyscallDispatcher::invoke(ProcessExecutionContext& ctx, SyscallNumber num,
                                        const std::vector<std::uint64_t>& args, Tick now) {
  total_invocations_++;
  call_counts_[to_string(num)]++;

  // Step 1: Privilege Escalation (User -> Kernel)
  ctx.trap_enter();

  if (log_) {
    std::ostringstream ss;
    ss << "{\"pid\":" << ctx.pid
       << ",\"prev_mode\":\"USER\""
       << ",\"new_mode\":\"KERNEL\""
       << ",\"trap_vector\":128" // 0x80
       << ",\"sp_kernel\":" << ctx.regs.sp_kernel << "}";
    log_->emit("syscall", "privilege_escalated", ctx.pid, now, ss.str());

    std::ostringstream ss_call;
    ss_call << "{\"syscall\":\"" << to_string(num) << "\",\"num\":" << static_cast<uint32_t>(num)
            << ",\"arg_count\":" << args.size() << "}";
    log_->emit("syscall", "syscall_invoked", ctx.pid, now, ss_call.str());
  }

  // Step 2: Execute Kernel System Call
  SyscallResult res = execute_kernel(ctx, num, args, now);
  total_kernel_ticks_ += res.ticks_spent;

  if (res.is_success()) {
    successful_invocations_++;
  } else {
    failed_invocations_++;
  }

  // Step 3: Privilege Restoration (Kernel -> User)
  ctx.trap_exit();
  ctx.regs.r[0] = static_cast<std::uint64_t>(res.return_value);

  if (log_) {
    std::ostringstream ss_ret;
    ss_ret << "{\"syscall\":\"" << to_string(num)
           << "\",\"return_value\":" << res.return_value
           << ",\"error_code\":" << res.error_code
           << ",\"ticks_spent\":" << res.ticks_spent
           << ",\"success\":" << (res.is_success() ? "true" : "false") << "}";
    log_->emit("syscall", "syscall_returned", ctx.pid, now + res.ticks_spent, ss_ret.str());

    std::ostringstream ss_mode;
    ss_mode << "{\"pid\":" << ctx.pid
            << ",\"prev_mode\":\"KERNEL\""
            << ",\"new_mode\":\"USER\""
            << ",\"sp_user\":" << ctx.regs.sp_user << "}";
    log_->emit("syscall", "privilege_restored", ctx.pid, now + res.ticks_spent, ss_mode.str());
  }

  return res;
}

SyscallResult SyscallDispatcher::execute_kernel(ProcessExecutionContext& ctx, SyscallNumber num,
                                                const std::vector<std::uint64_t>& args, Tick now) {
  SyscallResult res;
  res.ticks_spent = 1;

  switch (num) {
    case SyscallNumber::SysGetPid: {
      res.return_value = ctx.pid;
      res.message = "Process ID retrieved";
      return res;
    }

    case SyscallNumber::SysYield: {
      res.return_value = 0;
      res.message = "CPU yield dispatched";
      return res;
    }

    case SyscallNumber::SysSleep: {
      if (args.empty()) {
        res.return_value = -1;
        res.error_code = 22; // EINVAL
        res.message = "EINVAL: missing duration argument";
        return res;
      }
      res.return_value = 0;
      res.ticks_spent = static_cast<Tick>(args[0]);
      res.message = "Sleep duration completed";
      return res;
    }

    case SyscallNumber::SysExit: {
      int exit_code = args.empty() ? 0 : static_cast<int>(args[0]);
      res.return_value = exit_code;
      res.message = "Process exited";
      return res;
    }

    case SyscallNumber::SysFork: {
      // Simulates process duplication with child PID allocated
      ProcessId child_pid = ctx.pid + 100;
      res.return_value = child_pid;
      res.message = "Child process spawned";
      return res;
    }

    case SyscallNumber::SysPipe: {
      if (!ipc_) {
        res.return_value = -1;
        res.error_code = 38; // ENOSYS
        res.message = "IPC subsystem unavailable";
        return res;
      }
      std::size_t capacity = args.empty() ? 512 : static_cast<std::size_t>(args[0]);
      PipeId pipe_id = ipc_->create_pipe(capacity, ctx.pid, ctx.pid, now);
      res.return_value = pipe_id;
      res.message = "Pipe created successfully";
      return res;
    }

    case SyscallNumber::SysMqSend: {
      if (!ipc_) {
        res.return_value = -1;
        res.error_code = 38; // ENOSYS
        res.message = "IPC subsystem unavailable";
        return res;
      }
      if (args.size() < 3) {
        res.return_value = -1;
        res.error_code = 22; // EINVAL
        res.message = "EINVAL: missing mq_id, msg_type, or priority arguments";
        return res;
      }
      MqId mq_id = static_cast<MqId>(args[0]);
      std::int64_t msg_type = static_cast<std::int64_t>(args[1]);
      std::uint32_t priority = static_cast<std::uint32_t>(args[2]);

      auto* mq = ipc_->get_mq(mq_id);
      if (!mq) {
        res.return_value = -1;
        res.error_code = 9; // EBADF
        res.message = "EBADF: invalid message queue handle";
        return res;
      }

      std::string payload = "DATA_PAYLOAD";
      bool ok = mq->send(ctx.pid, msg_type, priority, payload, now);
      if (!ok) {
        res.return_value = -1;
        res.error_code = 11; // EAGAIN
        res.message = "EAGAIN: message queue full or message too large";
        return res;
      }
      res.return_value = 0;
      res.message = "Message enqueued";
      return res;
    }

    case SyscallNumber::SysMqRecv: {
      if (!ipc_) {
        res.return_value = -1;
        res.error_code = 38; // ENOSYS
        res.message = "IPC subsystem unavailable";
        return res;
      }
      if (args.empty()) {
        res.return_value = -1;
        res.error_code = 22; // EINVAL
        res.message = "EINVAL: missing mq_id";
        return res;
      }
      MqId mq_id = static_cast<MqId>(args[0]);
      std::int64_t filter_type = args.size() > 1 ? static_cast<std::int64_t>(args[1]) : 0;

      auto* mq = ipc_->get_mq(mq_id);
      if (!mq) {
        res.return_value = -1;
        res.error_code = 9; // EBADF
        res.message = "EBADF: invalid message queue handle";
        return res;
      }

      auto msg = mq->receive(ctx.pid, filter_type, now);
      if (!msg.has_value()) {
        res.return_value = -1;
        res.error_code = 11; // EAGAIN
        res.message = "EAGAIN: no messages matching filter criteria";
        return res;
      }
      res.return_value = static_cast<std::int64_t>(msg->id);
      res.message = "Message dequeued";
      return res;
    }

    case SyscallNumber::SysShmGet: {
      if (!ipc_) {
        res.return_value = -1;
        res.error_code = 38;
        res.message = "IPC subsystem unavailable";
        return res;
      }
      if (args.empty()) {
        res.return_value = -1;
        res.error_code = 22;
        res.message = "EINVAL: missing shm key";
        return res;
      }
      std::uint32_t key = static_cast<std::uint32_t>(args[0]);
      std::size_t size = args.size() > 1 ? static_cast<std::size_t>(args[1]) : 4096;
      auto* existing = ipc_->get_shm_by_key(key);
      if (existing) {
        res.return_value = existing->id();
        res.message = "Existing shared memory segment found";
      } else {
        ShmId shmid = ipc_->create_shm(key, size, now);
        res.return_value = shmid;
        res.message = "New shared memory segment created";
      }
      return res;
    }

    case SyscallNumber::SysShmAttach: {
      if (!ipc_) {
        res.return_value = -1;
        res.error_code = 38;
        res.message = "IPC subsystem unavailable";
        return res;
      }
      if (args.empty()) {
        res.return_value = -1;
        res.error_code = 22;
        res.message = "EINVAL: missing shmid";
        return res;
      }
      ShmId shmid = static_cast<ShmId>(args[0]);
      auto* shm = ipc_->get_shm(shmid);
      if (!shm) {
        res.return_value = -1;
        res.error_code = 9; // EBADF
        res.message = "EBADF: invalid shmid handle";
        return res;
      }
      std::uint64_t vaddr = 0x60000000 + (static_cast<std::uint64_t>(shmid) * 0x10000);
      shm->attach(ctx.pid, vaddr, ShmPermission::ReadWrite, now);
      res.return_value = static_cast<std::int64_t>(vaddr);
      res.message = "Shared memory attached";
      return res;
    }

    case SyscallNumber::SysShmDetach: {
      if (!ipc_) {
        res.return_value = -1;
        res.error_code = 38;
        res.message = "IPC subsystem unavailable";
        return res;
      }
      if (args.empty()) {
        res.return_value = -1;
        res.error_code = 22;
        res.message = "EINVAL: missing shmid";
        return res;
      }
      ShmId shmid = static_cast<ShmId>(args[0]);
      auto* shm = ipc_->get_shm(shmid);
      if (!shm) {
        res.return_value = -1;
        res.error_code = 9;
        res.message = "EBADF: invalid shmid handle";
        return res;
      }
      bool ok = shm->detach(ctx.pid, now);
      res.return_value = ok ? 0 : -1;
      res.error_code = ok ? 0 : 22;
      res.message = ok ? "Shared memory detached" : "EINVAL: not attached";
      return res;
    }

    case SyscallNumber::SysOpen:
    case SyscallNumber::SysClose:
    case SyscallNumber::SysRead:
    case SyscallNumber::SysWrite: {
      // File I/O simulation via InodeFileSystem if available
      if (num == SyscallNumber::SysOpen) {
        res.return_value = 3; // simulated fd 3
        res.message = "File opened successfully";
      } else if (num == SyscallNumber::SysClose) {
        res.return_value = 0;
        res.message = "File closed successfully";
      } else if (num == SyscallNumber::SysRead) {
        res.return_value = args.size() > 1 ? static_cast<std::int64_t>(args[1]) : 16;
        res.message = "Bytes read";
      } else {
        res.return_value = args.size() > 1 ? static_cast<std::int64_t>(args[1]) : 16;
        res.message = "Bytes written";
      }
      return res;
    }

    default: {
      res.return_value = -1;
      res.error_code = 38; // ENOSYS
      res.message = "ENOSYS: unimplemented system call";
      return res;
    }
  }
}

SyscallMetrics SyscallDispatcher::compute_metrics() const {
  SyscallMetrics m;
  m.total_invocations = total_invocations_;
  m.successful_invocations = successful_invocations_;
  m.failed_invocations = failed_invocations_;
  m.total_kernel_ticks_spent = total_kernel_ticks_;
  m.call_counts = call_counts_;
  return m;
}

std::string SyscallResult::to_json() const {
  std::ostringstream ss;
  ss << "{"
     << "\"return_value\":" << return_value << ","
     << "\"error_code\":" << error_code << ","
     << "\"ticks_spent\":" << ticks_spent << ","
     << "\"message\":\"" << message << "\","
     << "\"success\":" << (is_success() ? "true" : "false")
     << "}";
  return ss.str();
}

std::string SyscallMetrics::to_json() const {
  std::ostringstream ss;
  ss << "{"
     << "\"total_invocations\":" << total_invocations << ","
     << "\"successful_invocations\":" << successful_invocations << ","
     << "\"failed_invocations\":" << failed_invocations << ","
     << "\"total_kernel_ticks_spent\":" << total_kernel_ticks_spent << ","
     << "\"call_counts\":{";
  bool first = true;
  for (const auto& pair : call_counts) {
    if (!first) ss << ",";
    first = false;
    ss << "\"" << pair.first << "\":" << pair.second;
  }
  ss << "}}";
  return ss.str();
}

std::string SyscallDispatcher::to_json() const {
  std::ostringstream ss;
  ss << "{"
     << "\"metrics\":" << compute_metrics().to_json()
     << "}";
  return ss.str();
}

void SyscallDispatcher::reset() {
  total_invocations_ = 0;
  successful_invocations_ = 0;
  failed_invocations_ = 0;
  total_kernel_ticks_ = 0;
  call_counts_.clear();
}

} // namespace kernellens
