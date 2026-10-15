/**
 * KernelLens Phase 4 Synchronization UI & Contract Tests
 * Validates RAG event replay, cycle edge highlighting from engine events,
 * explicit no-deadlock states, Banker's safe-sequence step progression,
 * and blocked process denial details.
 * 
 * Strict rule: NEVER implement deadlock detection in TypeScript.
 */

import { EngineBridge } from '../bridge/engineBridge';
import {
  replayRagState,
  GOLDEN_RAG_DEADLOCK_EVENTS,
  GOLDEN_RAG_RESOLVED_EVENTS,
  GOLDEN_RAG_COMPLEX_SAFE_EVENTS,
  GOLDEN_BANKER_SILBERSCHATZ
} from '../bridge/syncGoldenData';
import { SimulationRequest } from '../bridge/schema';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED]: ${message}`);
  }
}

async function runSyncTests() {
  console.log('========================================================');
  console.log('   Running KernelLens Phase 4 Sync UI & Contract Tests  ');
  console.log('========================================================\n');

  const bridge = new EngineBridge();

  // Test 1: RAG Replay and Cycle Edge Highlighting from Engine Events
  {
    console.log('Test 1: Validating RAG state reconstruction and cycle edge highlighting...');

    const ragState = replayRagState(GOLDEN_RAG_DEADLOCK_EVENTS);

    // Node validation
    assert(ragState.nodes.length === 4, `Expected 4 nodes, got ${ragState.nodes.length}`);
    const pNodes = ragState.nodes.filter(n => n.type === 'process');
    const rNodes = ragState.nodes.filter(n => n.type === 'resource');
    assert(pNodes.length === 2, `Expected 2 process nodes, got ${pNodes.length}`);
    assert(rNodes.length === 2, `Expected 2 resource nodes, got ${rNodes.length}`);

    // Edge validation
    assert(ragState.edges.length === 4, `Expected 4 edges, got ${ragState.edges.length}`);
    const reqEdges = ragState.edges.filter(e => e.kind === 'REQUEST');
    const assignEdges = ragState.edges.filter(e => e.kind === 'ASSIGNMENT');
    assert(reqEdges.length === 2, `Expected 2 request edges, got ${reqEdges.length}`);
    assert(assignEdges.length === 2, `Expected 2 assignment edges, got ${assignEdges.length}`);

    // Deadlock detection report from engine
    assert(ragState.deadlock.hasDeadlock === true, 'Engine deadlock flag must be true');
    assert(ragState.deadlock.cycleCount === 1, 'Engine cycleCount must be 1');
    assert(ragState.deadlock.cycles.length === 1, 'Must have 1 cycle in array');

    // Cycle edges extracted without UI cycle detection
    assert(ragState.cycleEdges.has('P1->R1'), 'Cycle must include P1->R1');
    assert(ragState.cycleEdges.has('R1->P2'), 'Cycle must include R1->P2');
    assert(ragState.cycleEdges.has('P2->R2'), 'Cycle must include P2->R2');
    assert(ragState.cycleEdges.has('R2->P1'), 'Cycle must include R2->P1');

    // All 4 edges should have inCycle set to true
    for (const e of ragState.edges) {
      assert(e.inCycle === true, `Edge ${e.from}->${e.to} must be marked inCycle`);
    }

    // All 4 nodes should have inCycle set to true
    for (const n of ragState.nodes) {
      assert(n.inCycle === true, `Node ${n.id} must be marked inCycle`);
    }

    console.log(' [PASS] RAG deadlock cycle successfully identified and highlighted from engine events.\n');
  }

  // Test 2: Explicit No-Deadlock State Verification
  {
    console.log('Test 2: Validating explicit no-deadlock state when cycle is broken...');

    const resolvedState = replayRagState(GOLDEN_RAG_RESOLVED_EVENTS);

    assert(resolvedState.deadlock.hasDeadlock === false, 'Engine hasDeadlock must be false');
    assert(resolvedState.deadlock.cycleCount === 0, 'cycleCount must be 0');
    assert(resolvedState.deadlock.cycles.length === 0, 'cycles array must be empty');

    // Edge P2 -> R2 was removed
    assert(resolvedState.edges.length === 3, `Expected 3 edges after removal, got ${resolvedState.edges.length}`);
    assert(!resolvedState.edges.some(e => e.from === 'P2' && e.to === 'R2'), 'P2->R2 edge must be removed');

    // No edge or node in cycle
    assert(resolvedState.cycleEdges.size === 0, 'cycleEdges set must be empty');
    assert(resolvedState.cycleNodes.size === 0, 'cycleNodes set must be empty');

    for (const e of resolvedState.edges) {
      assert(e.inCycle === false, `Edge ${e.from}->${e.to} must NOT be inCycle`);
    }
    for (const n of resolvedState.nodes) {
      assert(n.inCycle === false, `Node ${n.id} must NOT be inCycle`);
    }

    console.log(' [PASS] Explicit no-deadlock state verified (zero cycles, no false positive highlights).\n');
  }

  // Test 3: Multi-Resource Hierarchy Safe Graph
  {
    console.log('Test 3: Validating multi-resource safe hierarchy replay...');

    const complexState = replayRagState(GOLDEN_RAG_COMPLEX_SAFE_EVENTS);

    assert(complexState.nodes.length === 6, `Expected 6 nodes (3P, 3R), got ${complexState.nodes.length}`);
    assert(complexState.edges.length === 5, `Expected 5 edges, got ${complexState.edges.length}`);
    assert(complexState.deadlock.hasDeadlock === false, 'Multi-resource safe graph must be deadlock free');

    console.log(' [PASS] Multi-resource graph verified without deadlock.\n');
  }

  // Test 4: Banker's Algorithm Safe-Sequence Stepper States
  {
    console.log('Test 4: Validating Banker\'s Algorithm safe sequence step progression...');

    const scenario = GOLDEN_BANKER_SILBERSCHATZ;
    assert(scenario.isSafe === true, 'Benchmark initial state must be safe');
    assert(scenario.safeSequence.length === 5, 'Safe sequence must include all 5 processes');
    assert(scenario.safeSequence[0] === 1, 'First process in safe sequence must be P1');
    assert(scenario.safeSequence[1] === 3, 'Second process in safe sequence must be P3');
    assert(scenario.safeSequence[2] === 4, 'Third process in safe sequence must be P4');
    assert(scenario.safeSequence[3] === 0, 'Fourth process in safe sequence must be P0');
    assert(scenario.safeSequence[4] === 2, 'Fifth process in safe sequence must be P2');

    // Verify step states
    const steps = scenario.steps;
    assert(steps.length === 6, `Expected 6 steps (0..5), got ${steps.length}`);

    // Step 0: Start
    assert(steps[0].stepIndex === 0, 'Step 0 index must be 0');
    assert(steps[0].workAfter[0] === 3 && steps[0].workAfter[1] === 3 && steps[0].workAfter[2] === 2, 'Initial Work = [3, 3, 2]');
    assert(steps[0].processes.every(p => !p.finished), 'All processes start pending');

    // Step 1: P1 finishes
    assert(steps[1].currentPid === 1, 'Step 1 executes P1');
    assert(steps[1].workAfter[0] === 5 && steps[1].workAfter[1] === 3 && steps[1].workAfter[2] === 2, 'Work after P1 = [5, 3, 2]');
    const p1State = steps[1].processes.find(p => p.pid === 1);
    assert(p1State?.finished === true, 'P1 must be finished at Step 1');

    // Step 2: P3 finishes
    assert(steps[2].currentPid === 3, 'Step 2 executes P3');
    assert(steps[2].workAfter[0] === 7 && steps[2].workAfter[1] === 4 && steps[2].workAfter[2] === 3, 'Work after P3 = [7, 4, 3]');

    // Step 3: P4 finishes
    assert(steps[3].currentPid === 4, 'Step 3 executes P4');
    assert(steps[3].workAfter[0] === 7 && steps[3].workAfter[1] === 4 && steps[3].workAfter[2] === 5, 'Work after P4 = [7, 4, 5]');

    // Step 4: P0 finishes
    assert(steps[4].currentPid === 0, 'Step 4 executes P0');
    assert(steps[4].workAfter[0] === 7 && steps[4].workAfter[1] === 5 && steps[4].workAfter[2] === 5, 'Work after P0 = [7, 5, 5]');

    // Step 5: P2 finishes
    assert(steps[5].currentPid === 2, 'Step 5 executes P2');
    assert(steps[5].workAfter[0] === 10 && steps[5].workAfter[1] === 5 && steps[5].workAfter[2] === 7, 'Final Work = [10, 5, 7]');
    assert(steps[5].processes.every(p => p.finished), 'All processes must be finished at final step');

    console.log(' [PASS] Banker safe-sequence steps verified from Work=[3,3,2] to Work=[10,5,7].\n');
  }

  // Test 5: Blocked Process Denial Details Verification
  {
    console.log('Test 5: Validating blocked-process denial events and explanation details...');

    const events = GOLDEN_BANKER_SILBERSCHATZ.events;

    // Granted Request: P1 [1, 0, 2]
    const grantedReq = events.find(e => e.type === 'banker_request_granted');
    assert(grantedReq !== undefined, 'Must have banker_request_granted event');
    assert(grantedReq!.details.granted === true, 'Granted flag must be true');
    assert(grantedReq!.pid === 1, 'Granted PID must be 1');

    // Denied Request 1: P4 [3, 3, 0] exceeds available
    const deniedReq1 = events.find(e => e.time === 20);
    assert(deniedReq1 !== undefined, 'Must have denied request event at time 20');
    assert(deniedReq1!.type === 'banker_request_denied', 'Event type must be banker_request_denied');
    assert(deniedReq1!.details.granted === false, 'granted must be false');
    assert(deniedReq1!.pid === 4, 'Blocked process PID must be 4');
    assert(
      deniedReq1!.details.reason.includes('Resources not available'),
      `Reason must mention unavailable resources, got: "${deniedReq1!.details.reason}"`
    );

    // Denied Request 2: P0 [0, 2, 0] unsafe state
    const deniedReq2 = events.find(e => e.time === 30);
    assert(deniedReq2 !== undefined, 'Must have denied request event at time 30');
    assert(deniedReq2!.type === 'banker_request_denied', 'Event type must be banker_request_denied');
    assert(deniedReq2!.details.granted === false, 'granted must be false');
    assert(deniedReq2!.pid === 0, 'Blocked process PID must be 0');
    assert(
      deniedReq2!.details.reason.includes('UNSAFE state'),
      `Reason must mention unsafe state, got: "${deniedReq2!.details.reason}"`
    );

    console.log(' [PASS] Blocked process denial details and safety invariants verified.\n');
  }

  // Test 6: EngineBridge Subsystem Dispatch for Sync
  {
    console.log('Test 6: Validating EngineBridge dispatch for module: "sync"...');

    const bankerReq: SimulationRequest = {
      schemaVersion: 1,
      runId: 'test-sync-banker',
      seed: 42,
      module: 'sync',
      policy: { name: 'BANKER' },
      workload: {}
    };

    const bankerResp = await bridge.run(bankerReq);
    assert(bankerResp.status === 'completed', 'Banker run must return completed');
    assert(bankerResp.events.length >= 4, 'Banker must return event stream');

    const ragReq: SimulationRequest = {
      schemaVersion: 1,
      runId: 'test-sync-rag',
      seed: 42,
      module: 'sync',
      policy: { name: 'RAG' },
      workload: {}
    };

    const ragResp = await bridge.run(ragReq);
    assert(ragResp.status === 'completed', 'RAG run must return completed');
    assert(ragResp.events.length >= 5, 'RAG must return event stream');

    // Unsupported sync policy check
    let caught = false;
    try {
      await bridge.run({
        schemaVersion: 1,
        runId: 'test-sync-invalid',
        seed: 42,
        module: 'sync',
        policy: { name: 'MAGIC_LOCK' },
        workload: {}
      });
    } catch (err: any) {
      caught = true;
      assert(err.message.includes('Unsupported Synchronization policy'), 'Must report unsupported sync policy');
    }
    assert(caught, 'Bridge must reject invalid sync policies');

    console.log(' [PASS] EngineBridge sync dispatch verified.\n');
  }

  console.log('========================================================');
  console.log('   ALL PHASE 4 SYNC UI & CONTRACT TESTS PASSED (6/6)    ');
  console.log('========================================================\n');
}

runSyncTests().catch(err => {
  console.error('[FAILED]:', err);
  process.exit(1);
});
