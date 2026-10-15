#pragma once

#include "kernellens/core/types.hpp"
#include <cstdint>
#include <string>
#include <vector>

namespace kernellens {

enum class CpuPrivilegeMode {
  Kernel = 0, // Supervisor / Ring 0
  User = 3    // Application / Ring 3
};

inline std::string to_string(CpuPrivilegeMode mode) {
  return mode == CpuPrivilegeMode::Kernel ? "KERNEL" : "USER";
}

struct CpuRegisters {
  std::uint64_t pc = 0x00400000;              // Program Counter
  std::uint64_t sp_user = 0x7FFFFFFF0000;      // User Stack Pointer
  std::uint64_t sp_kernel = 0xFFFFFFFF0000;    // Kernel Stack Pointer
  std::uint64_t r[8] = {0, 0, 0, 0, 0, 0, 0, 0}; // r0=return/arg0, r1=arg1, r2=arg2, r3=arg3, r4..r7
  std::uint32_t psr = 0x00000003;             // Status Register (bit 0: User=1, bit 1: IF=1)

  bool is_user_mode() const noexcept { return (psr & 0x1) != 0; }
  void set_user_mode() noexcept { psr |= 0x1; }
  void set_kernel_mode() noexcept { psr &= ~0x1; }

  bool interrupts_enabled() const noexcept { return (psr & 0x2) != 0; }
  void enable_interrupts() noexcept { psr |= 0x2; }
  void disable_interrupts() noexcept { psr &= ~0x2; }
};

struct ProcessExecutionContext {
  ProcessId pid = 0;
  CpuPrivilegeMode mode = CpuPrivilegeMode::User;
  CpuRegisters regs;
  std::vector<CpuRegisters> saved_kernel_stack;

  ProcessExecutionContext() {
    regs.set_user_mode();
  }
  ProcessExecutionContext(ProcessId p, std::uint64_t initial_pc, std::uint64_t initial_sp_user,
                          std::uint64_t initial_sp_kernel, Tick /*now*/ = 0)
      : pid(p), mode(CpuPrivilegeMode::User) {
    regs.pc = initial_pc;
    regs.sp_user = initial_sp_user;
    regs.sp_kernel = initial_sp_kernel;
    regs.set_user_mode();
  }

  void trap_enter() {
    saved_kernel_stack.push_back(regs);
    mode = CpuPrivilegeMode::Kernel;
    regs.set_kernel_mode();
  }

  bool trap_exit() {
    if (saved_kernel_stack.empty()) return false;
    regs = saved_kernel_stack.back();
    saved_kernel_stack.pop_back();
    mode = regs.is_user_mode() ? CpuPrivilegeMode::User : CpuPrivilegeMode::Kernel;
    return true;
  }
};

} // namespace kernellens
