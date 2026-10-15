#include "test_harness.hpp"
#include "kernellens/syscall/syscall_table.hpp"
#include "kernellens/ipc/ipc_manager.hpp"

using namespace kernellens;

TEST_CASE(Syscall_PrivilegeMode_Escalation_And_Restoration) {
  EventLog log;
  IpcManager ipc(&log);
  SyscallDispatcher dispatcher(&log, &ipc, nullptr);

  ProcessExecutionContext ctx;
  ctx.pid = 42;
  ctx.mode = CpuPrivilegeMode::User;
  ctx.regs.pc = 0x00401000;
  ctx.regs.sp_user = 0x7FFFFFFF1000;
  ctx.regs.r[1] = 0xABCDEF;

  ASSERT_TRUE(ctx.regs.is_user_mode());
  ASSERT_EQ(ctx.mode, CpuPrivilegeMode::User);

  // Invoke SYS_GETPID
  auto res = dispatcher.invoke(ctx, SyscallNumber::SysGetPid, {}, 10);

  ASSERT_TRUE(res.is_success());
  ASSERT_EQ(res.return_value, 42);

  // Verify CPU execution mode was restored to User mode
  ASSERT_EQ(ctx.mode, CpuPrivilegeMode::User);
  ASSERT_TRUE(ctx.regs.is_user_mode());

  // Return value placed in r0
  ASSERT_EQ(ctx.regs.r[0], 42u);
  // User stack pointer preserved
  ASSERT_EQ(ctx.regs.sp_user, 0x7FFFFFFF1000u);
}

TEST_CASE(Syscall_IPC_Dispatching_Pipes_And_Queues) {
  EventLog log;
  IpcManager ipc(&log);
  SyscallDispatcher dispatcher(&log, &ipc, nullptr);

  ProcessExecutionContext ctx;
  ctx.pid = 1;

  // 1. SYS_PIPE: create pipe
  auto res_pipe = dispatcher.invoke(ctx, SyscallNumber::SysPipe, {256}, 0);
  ASSERT_TRUE(res_pipe.is_success());
  PipeId pipe_id = static_cast<PipeId>(res_pipe.return_value);
  ASSERT_NE(ipc.get_pipe(pipe_id), nullptr);

  // Create message queue manually in IPC manager
  MqId mq_id = ipc.create_mq("syscall_mq", 5, 128, 1);

  // 2. SYS_MQ_SEND: send message via syscall
  auto res_send = dispatcher.invoke(ctx, SyscallNumber::SysMqSend, {mq_id, 1, 10}, 2);
  ASSERT_TRUE(res_send.is_success());
  ASSERT_EQ(ipc.get_mq(mq_id)->size(), 1u);

  // 3. SYS_MQ_RECV: receive message via syscall
  auto res_recv = dispatcher.invoke(ctx, SyscallNumber::SysMqRecv, {mq_id, 1}, 3);
  ASSERT_TRUE(res_recv.is_success());
  ASSERT_EQ(ipc.get_mq(mq_id)->size(), 0u);
}

TEST_CASE(Syscall_InvalidSyscall_And_ArgumentErrors) {
  EventLog log;
  SyscallDispatcher dispatcher(&log, nullptr, nullptr);

  ProcessExecutionContext ctx;
  ctx.pid = 99;

  // Invalid syscall number cast
  auto res_invalid = dispatcher.invoke(ctx, static_cast<SyscallNumber>(9999), {}, 0);
  ASSERT_FALSE(res_invalid.is_success());
  ASSERT_EQ(res_invalid.error_code, 38); // ENOSYS

  // SYS_SLEEP with missing argument
  auto res_sleep = dispatcher.invoke(ctx, SyscallNumber::SysSleep, {}, 1);
  ASSERT_FALSE(res_sleep.is_success());
  ASSERT_EQ(res_sleep.error_code, 22); // EINVAL
}
