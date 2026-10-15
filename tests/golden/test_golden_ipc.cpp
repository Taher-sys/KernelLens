#include "test_harness.hpp"
#include "kernellens/ipc/pipe.hpp"
#include "kernellens/ipc/message_queue.hpp"
#include "kernellens/syscall/syscall_table.hpp"

using namespace kernellens;

TEST_CASE(Golden_IPC_UnixPipe_ProducerConsumer_ByteStream) {
  EventLog log;
  Pipe pipe(1, 32, &log);

  // Producer P1 writes 24 bytes in chunks
  pipe.write("CHUNK1_HEADER_", 1, 0);
  pipe.write("CHUNK2_PAYLOAD", 1, 1);
  ASSERT_EQ(pipe.bytes_available(), 28u);

  // Consumer P2 drains 14 bytes
  std::string part1 = pipe.read_string(14, 2, 2);
  ASSERT_EQ(part1, "CHUNK1_HEADER_");
  ASSERT_EQ(pipe.bytes_available(), 14u);

  // Producer writes 14 more bytes (triggering circular buffer wrap-around)
  pipe.write("_CHUNK3_TRAILER", 1, 3);
  ASSERT_EQ(pipe.bytes_available(), 29u);

  // Producer closes write end
  pipe.close_write(1, 4);

  // Consumer drains remaining stream until EOF
  std::string part2 = pipe.read_string(32, 2, 5);
  ASSERT_EQ(part2, "CHUNK2_PAYLOAD_CHUNK3_TRAILER");
  ASSERT_TRUE(pipe.is_empty());

  std::string eof_check = pipe.read_string(10, 2, 6);
  ASSERT_TRUE(eof_check.empty());

  auto metrics = pipe.compute_metrics();
  ASSERT_EQ(metrics.total_written, 43u);
  ASSERT_EQ(metrics.total_read, 43u);
  ASSERT_EQ(metrics.broken_pipe_events, 0u);
}

TEST_CASE(Golden_IPC_MessageQueue_PriorityDelivery_Sequence) {
  EventLog log;
  MessageQueue mq(10, "telemetry_queue", 10, 128, &log);

  // Ingest batch of messages in arbitrary order
  mq.send(10, 1, 1, "LOW_PRIO_HEARTBEAT", 0);
  mq.send(11, 2, 10, "CRITICAL_ENGINE_FAULT", 1);
  mq.send(12, 1, 5, "MED_PRIO_METRICS", 2);
  mq.send(13, 2, 10, "CRITICAL_OVERHEAT", 3);
  mq.send(14, 3, 2, "LOW_PRIO_LOG", 4);

  // Verify deterministic priority retrieval order:
  // 1: CRITICAL_ENGINE_FAULT (Prio 10, FIFO 1st)
  auto m1 = mq.receive(1, 0, 5);
  ASSERT_TRUE(m1.has_value());
  ASSERT_EQ(m1->payload, "CRITICAL_ENGINE_FAULT");
  ASSERT_EQ(m1->priority, 10u);

  // 2: CRITICAL_OVERHEAT (Prio 10, FIFO 2nd)
  auto m2 = mq.receive(1, 0, 6);
  ASSERT_TRUE(m2.has_value());
  ASSERT_EQ(m2->payload, "CRITICAL_OVERHEAT");
  ASSERT_EQ(m2->priority, 10u);

  // 3: MED_PRIO_METRICS (Prio 5)
  auto m3 = mq.receive(1, 0, 7);
  ASSERT_TRUE(m3.has_value());
  ASSERT_EQ(m3->payload, "MED_PRIO_METRICS");
  ASSERT_EQ(m3->priority, 5u);

  // 4: LOW_PRIO_LOG (Prio 2)
  auto m4 = mq.receive(1, 0, 8);
  ASSERT_TRUE(m4.has_value());
  ASSERT_EQ(m4->payload, "LOW_PRIO_LOG");
  ASSERT_EQ(m4->priority, 2u);

  // 5: LOW_PRIO_HEARTBEAT (Prio 1)
  auto m5 = mq.receive(1, 0, 9);
  ASSERT_TRUE(m5.has_value());
  ASSERT_EQ(m5->payload, "LOW_PRIO_HEARTBEAT");
  ASSERT_EQ(m5->priority, 1u);

  ASSERT_TRUE(mq.is_empty());
}

TEST_CASE(Golden_Syscall_PrivilegeMode_Trace_Schema) {
  EventLog log;
  SyscallDispatcher dispatcher(&log, nullptr, nullptr);

  ProcessExecutionContext ctx;
  ctx.pid = 7;
  ctx.mode = CpuPrivilegeMode::User;

  // Execute SYS_GETPID (takes 1 tick)
  auto res = dispatcher.invoke(ctx, SyscallNumber::SysGetPid, {}, 10);
  ASSERT_TRUE(res.is_success());
  ASSERT_EQ(res.return_value, 7);

  // Verify that EventLog contains schemaVersion: 1 events matching the lifecycle:
  // privilege_escalated -> syscall_invoked -> syscall_returned -> privilege_restored
  const auto& events = log.events();
  ASSERT_EQ(events.size(), 4u);

  ASSERT_EQ(events[0].type, "privilege_escalated");
  ASSERT_EQ(events[0].subsystem, "syscall");
  ASSERT_EQ(events[0].time, 10);
  ASSERT_EQ(events[0].pid.value_or(0), 7u);

  ASSERT_EQ(events[1].type, "syscall_invoked");
  ASSERT_EQ(events[1].time, 10);

  ASSERT_EQ(events[2].type, "syscall_returned");
  ASSERT_EQ(events[2].time, 11);

  ASSERT_EQ(events[3].type, "privilege_restored");
  ASSERT_EQ(events[3].time, 11);
}
