#include "test_harness.hpp"
#include "kernellens/interrupt/interrupt.hpp"

using namespace kernellens;

TEST_CASE(Interrupt_VectorRegistration_And_Dispatch) {
  EventLog log;
  InterruptController ic(&log);

  bool timer_fired = false;
  ic.register_vector(32, InterruptType::Hardware, "TIMER_TICK", 2,
    [&timer_fired](Tick, ProcessExecutionContext&) {
      timer_fired = true;
    });

  ProcessExecutionContext ctx;
  ctx.pid = 1;

  bool dispatched = ic.raise_interrupt(32, "PIT_CHANNEL_0", &ctx, 10);
  ASSERT_TRUE(dispatched);
  ASSERT_TRUE(timer_fired);
  ASSERT_EQ(ic.current_ipl(), 2u);

  ic.complete_interrupt(32, ctx, 11);
  ASSERT_EQ(ic.current_ipl(), 255u);
}

TEST_CASE(Interrupt_Masking_CLI_STI_And_DeferredQueue) {
  EventLog log;
  InterruptController ic(&log);

  int handler_count = 0;
  ic.register_vector(33, InterruptType::Hardware, "KEYBOARD_IRQ", 5,
    [&handler_count](Tick, ProcessExecutionContext&) {
      handler_count++;
    });

  ProcessExecutionContext ctx;
  ctx.pid = 1;

  // Mask interrupts globally (CLI)
  ic.disable_interrupts(0);
  ASSERT_FALSE(ic.are_interrupts_enabled());

  // Raising hardware interrupt should be deferred to pending queue
  bool dispatched = ic.raise_interrupt(33, "KBD_SCANCODE", &ctx, 1);
  ASSERT_FALSE(dispatched);
  ASSERT_EQ(handler_count, 0);
  ASSERT_EQ(ic.pending_count(), 1u);

  // Unmask interrupts globally (STI)
  ic.enable_interrupts(2);
  ASSERT_TRUE(ic.are_interrupts_enabled());

  // Dispatch pending interrupts
  bool pending_ran = ic.dispatch_pending(ctx, 3);
  ASSERT_TRUE(pending_ran);
  ASSERT_EQ(handler_count, 1);
  ASSERT_EQ(ic.pending_count(), 0u);
}

TEST_CASE(Interrupt_PriorityPreemption_And_Nesting) {
  EventLog log;
  InterruptController ic(&log);

  std::vector<std::string> execution_order;

  // Vector 33: Priority 5 (Lower priority hardware)
  ic.register_vector(33, InterruptType::Hardware, "KEYBOARD", 5,
    [&](Tick, ProcessExecutionContext&) {
      execution_order.push_back("KEYBOARD_START");
    });

  // Vector 32: Priority 2 (Higher priority hardware)
  ic.register_vector(32, InterruptType::Hardware, "TIMER", 2,
    [&](Tick, ProcessExecutionContext&) {
      execution_order.push_back("TIMER_PREEMPT");
    });

  ProcessExecutionContext ctx;
  ctx.pid = 1;

  // 1. Dispatch lower priority (KEYBOARD) -> IPL becomes 5
  ic.raise_interrupt(33, "KEYBOARD_KEY", &ctx, 0);
  ASSERT_EQ(ic.current_ipl(), 5u);

  // 2. While IPL is 5, higher-priority TIMER (prio 2 < 5) fires -> NESTED PREEMPTION!
  bool nested = ic.raise_interrupt(32, "TIMER_TICK", &ctx, 1);
  ASSERT_TRUE(nested);
  ASSERT_EQ(ic.current_ipl(), 2u);

  // Complete TIMER -> IPL returns to 5
  ic.complete_interrupt(32, ctx, 2);
  ASSERT_EQ(ic.current_ipl(), 5u);

  // Complete KEYBOARD -> IPL returns to 255
  ic.complete_interrupt(33, ctx, 3);
  ASSERT_EQ(ic.current_ipl(), 255u);

  ASSERT_EQ(execution_order.size(), 2u);
  ASSERT_EQ(execution_order[0], "KEYBOARD_START");
  ASSERT_EQ(execution_order[1], "TIMER_PREEMPT");
  ASSERT_EQ(ic.compute_metrics().total_nested_interrupts, 1u);
}
