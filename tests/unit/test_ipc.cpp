#include "test_harness.hpp"
#include "kernellens/ipc/pipe.hpp"
#include "kernellens/ipc/message_queue.hpp"
#include "kernellens/ipc/shared_memory.hpp"
#include "kernellens/ipc/ipc_manager.hpp"

using namespace kernellens;

TEST_CASE(IPC_Pipe_CircularBuffer_WriteAndRead) {
  EventLog log;
  Pipe pipe(1, 16, &log);

  ASSERT_EQ(pipe.capacity(), 16u);
  ASSERT_EQ(pipe.bytes_available(), 0u);
  ASSERT_EQ(pipe.free_space(), 16u);
  ASSERT_TRUE(pipe.is_empty());

  std::string msg = "Hello123";
  std::size_t written = pipe.write(msg, 1, 0);
  ASSERT_EQ(written, 8u);
  ASSERT_EQ(pipe.bytes_available(), 8u);
  ASSERT_EQ(pipe.free_space(), 8u);

  std::string read_str = pipe.read_string(5, 2, 1);
  ASSERT_EQ(read_str, "Hello");
  ASSERT_EQ(pipe.bytes_available(), 3u);

  // Write across wrap-around boundary
  std::string msg2 = "WrapAround!";
  std::size_t written2 = pipe.write(msg2, 1, 2);
  ASSERT_EQ(written2, 11u);
  ASSERT_EQ(pipe.bytes_available(), 14u);

  std::string read_all = pipe.read_string(20, 2, 3);
  ASSERT_EQ(read_all, "123WrapAround!");
  ASSERT_TRUE(pipe.is_empty());
}

TEST_CASE(IPC_Pipe_CapacityBounds_And_PartialWrite) {
  Pipe pipe(2, 10);
  std::string big_data = "1234567890EXTRA";
  std::size_t written = pipe.write(big_data, 1, 0);
  ASSERT_EQ(written, 10u);
  ASSERT_TRUE(pipe.is_full());
  ASSERT_EQ(pipe.free_space(), 0u);

  // Attempt write on full pipe
  std::size_t written_more = pipe.write("X", 1, 1);
  ASSERT_EQ(written_more, 0u);

  // Drain 4 bytes
  std::string drained = pipe.read_string(4, 2, 2);
  ASSERT_EQ(drained, "1234");
  ASSERT_EQ(pipe.free_space(), 4u);

  // Write 4 bytes
  std::size_t written_again = pipe.write("ABCD", 1, 3);
  ASSERT_EQ(written_again, 4u);
  ASSERT_TRUE(pipe.is_full());
}

TEST_CASE(IPC_Pipe_BrokenPipe_And_EOF) {
  EventLog log;
  Pipe pipe(3, 32, &log);
  pipe.write("data_before_close", 1, 0);

  // Close write end: read should still succeed, then yield EOF
  pipe.close_write(1, 1);
  ASSERT_FALSE(pipe.is_write_open());
  std::string res = pipe.read_string(32, 2, 2);
  ASSERT_EQ(res, "data_before_close");

  // Subsequent read on empty closed pipe yields EOF
  std::string eof_res = pipe.read_string(10, 2, 3);
  ASSERT_TRUE(eof_res.empty());

  // Close read end: pipe is now broken
  pipe.close_read(2, 4);
  ASSERT_TRUE(pipe.is_broken());

  // Write to broken pipe causes EPIPE / SIGPIPE
  std::size_t w = pipe.write("will_fail", 1, 5);
  ASSERT_EQ(w, 0u);
  ASSERT_EQ(pipe.compute_metrics().broken_pipe_events, 1u);
}

TEST_CASE(IPC_MessageQueue_PriorityOrdering_And_FIFO) {
  EventLog log;
  MessageQueue mq(1, "test_prio_mq", 10, 256, &log);

  // Send messages with different priorities
  mq.send(101, 1, 2, "Prio2_First", 0);
  mq.send(102, 1, 10, "Prio10_High", 1);
  mq.send(103, 1, 5, "Prio5_Med", 2);
  mq.send(104, 1, 10, "Prio10_Second", 3); // Equal high priority, should be FIFO relative to 102

  ASSERT_EQ(mq.size(), 4u);

  // 1st received should be Prio10_High
  auto m1 = mq.receive(200, 0, 4);
  ASSERT_TRUE(m1.has_value());
  ASSERT_EQ(m1->payload, "Prio10_High");
  ASSERT_EQ(m1->priority, 10u);

  // 2nd received should be Prio10_Second
  auto m2 = mq.receive(200, 0, 5);
  ASSERT_TRUE(m2.has_value());
  ASSERT_EQ(m2->payload, "Prio10_Second");

  // 3rd received should be Prio5_Med
  auto m3 = mq.receive(200, 0, 6);
  ASSERT_TRUE(m3.has_value());
  ASSERT_EQ(m3->payload, "Prio5_Med");

  // 4th received should be Prio2_First
  auto m4 = mq.receive(200, 0, 7);
  ASSERT_TRUE(m4.has_value());
  ASSERT_EQ(m4->payload, "Prio2_First");

  ASSERT_TRUE(mq.is_empty());
}

TEST_CASE(IPC_MessageQueue_SelectiveReceive_ByType) {
  MessageQueue mq(2, "typed_mq", 10, 256);

  mq.send(1, 10, 1, "Control_A", 0);
  mq.send(1, 20, 5, "Telemetry_B", 1);
  mq.send(1, 10, 8, "Control_C", 2);
  mq.send(1, 30, 2, "Alert_D", 3);

  // Request only msg_type == 10: highest priority with type 10 is Control_C (prio 8)
  auto m_type10 = mq.receive(2, 10, 4);
  ASSERT_TRUE(m_type10.has_value());
  ASSERT_EQ(m_type10->payload, "Control_C");

  // Next request for type 10 should get Control_A
  auto m_type10_2 = mq.receive(2, 10, 5);
  ASSERT_TRUE(m_type10_2.has_value());
  ASSERT_EQ(m_type10_2->payload, "Control_A");

  // Request for type 999 (not present)
  auto m_none = mq.receive(2, 999, 6);
  ASSERT_FALSE(m_none.has_value());

  // Filter type < 0: lowest type <= abs(-25) -> type 20
  auto m_neg = mq.receive(2, -25, 7);
  ASSERT_TRUE(m_neg.has_value());
  ASSERT_EQ(m_neg->payload, "Telemetry_B");
}

TEST_CASE(IPC_MessageQueue_CapacityLimits) {
  MessageQueue mq(3, "bounded_mq", 3, 32);

  ASSERT_TRUE(mq.send(1, 1, 1, "Msg1", 0));
  ASSERT_TRUE(mq.send(1, 1, 1, "Msg2", 1));
  ASSERT_TRUE(mq.send(1, 1, 1, "Msg3", 2));
  ASSERT_TRUE(mq.is_full());

  // 4th send rejected (queue full)
  bool rejected = mq.send(1, 1, 1, "Msg4_Dropped", 3);
  ASSERT_FALSE(rejected);
  ASSERT_EQ(mq.compute_metrics().dropped_or_rejected, 1u);

  // Message size limit check (> 32 bytes)
  std::string huge(64, 'H');
  bool rejected_size = mq.send(1, 1, 1, huge, 4);
  ASSERT_FALSE(rejected_size);
}

TEST_CASE(IPC_SharedMemory_Permissions_And_RaceDetection) {
  EventLog log;
  SharedMemorySegment shm(10, 0x1234, 1024, &log);

  // Process 1 attaches ReadWrite, Process 2 attaches ReadOnly
  shm.attach(1, 0x60000000, ShmPermission::ReadWrite, 0);
  shm.attach(2, 0x70000000, ShmPermission::ReadOnly, 0);

  // P1 writes
  bool w1 = shm.write(1, 0, "SHARED_DATA_BLOCK", std::nullopt, 1);
  ASSERT_TRUE(w1);

  // P2 reads
  std::string r2 = shm.read_string(2, 0, 17, std::nullopt, 2);
  ASSERT_EQ(r2, "SHARED_DATA_BLOCK");

  // P2 attempts write on ReadOnly segment (permission denied)
  bool w2_fail = shm.write(2, 0, "ILLEGAL_WRITE", std::nullopt, 3);
  ASSERT_FALSE(w2_fail);

  // Process 3 attaches ReadWrite
  shm.attach(3, 0x80000000, ShmPermission::ReadWrite, 4);

  // P1 and P3 concurrent unprotected writes at the exact same tick -> race condition hazard detected!
  shm.write(1, 100, "DATA_FROM_P1", std::nullopt, 5);
  shm.write(3, 100, "DATA_FROM_P3", std::nullopt, 5);

  ASSERT_EQ(shm.compute_metrics().race_conditions_detected, 1u);

  // Synchronized write with lock_id does not increment race counter
  shm.write(1, 200, "SAFE_LOCK_P1", 99, 6);
  shm.write(3, 200, "SAFE_LOCK_P3", 99, 6);
  ASSERT_EQ(shm.compute_metrics().race_conditions_detected, 1u);
}

TEST_CASE(IPC_Manager_UnifiedSubsystem) {
  IpcManager mgr;
  PipeId p = mgr.create_pipe(128);
  MqId q = mgr.create_mq("sys_mq", 5, 128);
  ShmId s = mgr.create_shm(0xCAFE, 2048);

  ASSERT_NE(mgr.get_pipe(p), nullptr);
  ASSERT_NE(mgr.get_mq(q), nullptr);
  ASSERT_NE(mgr.get_shm(s), nullptr);
  ASSERT_NE(mgr.get_mq_by_name("sys_mq"), nullptr);
  ASSERT_NE(mgr.get_shm_by_key(0xCAFE), nullptr);

  auto metrics = mgr.compute_metrics();
  ASSERT_EQ(metrics.total_pipes, 1u);
  ASSERT_EQ(metrics.total_message_queues, 1u);
  ASSERT_EQ(metrics.total_shm_segments, 1u);
  ASSERT_EQ(metrics.total_shm_bytes, 2048u);
}
