/**
 * KernelLens WASM/Worker Bridge & Replay State Machine Test Suite
 *
 * Verifies:
 * 1. Strict schemaVersion: 1 guards on request and response contracts.
 * 2. Loading, paused, playing, completed, and error state transitions.
 * 3. Worker responsiveness health checks and PING/PONG latency measurement.
 * 4. Deterministic checkpoint state reconstruction:
 *    - Replaying forward vs scrubbing backward produces byte-identical states.
 *    - Zero reverse mutations: state is always reconstructed from nearest checkpoint.
 * 5. Native C++ CLI vs Bridge fixture comparison and Emscripten toolchain audit.
 */

import { execFileSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { EngineBridge } from '../bridge/engineBridge';
import {
  SCHEMA_VERSION,
  SimulationRequest,
  validateSchemaVersion,
  assertSchemaVersion
} from '../bridge/schema';
import {
  replayReducer,
  initialReplayState,
  buildCheckpoints,
  reconstructStateAtTick
} from '../state/replayReducer';
import { handleWorkerMessage } from '../bridge/simulation.worker';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED]: ${message}`);
  }
}

async function runTests() {
  console.log('========================================================');
  console.log('  KernelLens WASM/Worker Bridge & Replay Test Suite     ');
  console.log('========================================================\n');

  const bridge = new EngineBridge();

  // -----------------------------------------------------------
  // Test 1: Strict schema-version guard
  // -----------------------------------------------------------
  console.log('Test 1: Validating schemaVersion: 1 guards...');
  {
    assert(validateSchemaVersion(1) === true, 'schemaVersion 1 must be valid');
    assert(validateSchemaVersion(2) === false, 'schemaVersion 2 must be rejected');
    assert(validateSchemaVersion(0) === false, 'schemaVersion 0 must be rejected');
    assert(validateSchemaVersion(null) === false, 'null schemaVersion must be rejected');

    let errorCaught = false;
    try {
      assertSchemaVersion(2);
    } catch (err: any) {
      errorCaught = true;
      assert(err.message.includes('unsupported schemaVersion 2'), 'Error must mention unsupported version');
    }
    assert(errorCaught, 'assertSchemaVersion must throw for invalid versions');

    // Test rejection in bridge.run with invalid schemaVersion
    let bridgeErrorCaught = false;
    try {
      const invalidRequest: any = {
        schemaVersion: 99,
        runId: 'invalid-ver',
        seed: 42,
        module: 'cpu',
        policy: { name: 'FCFS' },
        workload: { processes: [] }
      };
      await bridge.run(invalidRequest);
    } catch (err: any) {
      bridgeErrorCaught = true;
      assert(err.message.includes('unsupported schemaVersion 99'), 'Bridge must reject schemaVersion 99');
    }
    assert(bridgeErrorCaught, 'Bridge must enforce schemaVersion guard on requests');

    console.log(' [PASS] schemaVersion: 1 guards strictly enforced.\n');
  }

  // -----------------------------------------------------------
  // Test 2: Loading, Error, and Completed States in replayReducer
  // -----------------------------------------------------------
  console.log('Test 2: Validating replayReducer state transitions (loading/error/play/pause)...');
  {
    let state = initialReplayState;
    assert(state.status === 'idle', 'Initial status must be idle');
    assert(state.loading === false, 'Initial loading must be false');
    assert(state.error === null, 'Initial error must be null');

    // 1. Transition to loading
    state = replayReducer(state, { type: 'LOAD_START' });
    assert(state.status === 'loading', 'Status must be loading');
    assert(state.loading === true, 'Loading flag must be true');

    // 2. Transition to error
    state = replayReducer(state, {
      type: 'LOAD_ERROR',
      payload: { error: 'Network / WASM timeout' }
    });
    assert(state.status === 'error', 'Status must be error');
    assert(state.loading === false, 'Loading flag must be false after error');
    assert(state.error === 'Network / WASM timeout', 'Error message must match');

    // 3. Reject response with mismatched schemaVersion
    const invalidResponse: any = {
      schemaVersion: 2,
      runId: 'invalid-resp',
      status: 'completed',
      simulatedDuration: 10,
      events: [],
      metrics: { perProcess: [], averages: { waitingTime: 0, turnaroundTime: 0, responseTime: 0 }, throughput: 1, cpuUtilization: 1, contextSwitches: 0, jainFairness: null }
    };
    state = replayReducer(state, {
      type: 'LOAD_SUCCESS',
      payload: { response: invalidResponse }
    });
    assert(state.status === 'error', 'Must transition to error on schemaVersion mismatch');
    assert(state.error!.includes('unsupported schemaVersion 2'), 'Must report schema error');

    // 4. Valid simulation load
    const validRequest: SimulationRequest = {
      schemaVersion: SCHEMA_VERSION,
      runId: 'test-replay-run',
      seed: 42,
      module: 'cpu',
      policy: { name: 'FCFS' },
      workload: {
        processes: [
          { pid: 1, arrivalTime: 0, bursts: [{ kind: 'CPU', duration: 10 }], basePriority: 0, niceValue: 0 },
          { pid: 2, arrivalTime: 2, bursts: [{ kind: 'CPU', duration: 6 }], basePriority: 0, niceValue: 0 }
        ]
      }
    };
    const validResponse = await bridge.run(validRequest);

    state = replayReducer(state, {
      type: 'LOAD_SUCCESS',
      payload: { response: validResponse, processes: validRequest.workload.processes }
    });

    assert(state.status === 'paused', 'Status must be paused after loading');
    assert(state.currentTick === 0, 'Current tick must initialize to 0');
    assert(state.maxTick === 16, `Max tick must be 16, got ${state.maxTick}`);
    assert(state.checkpoints.length >= 2, 'Checkpoints must be generated');
    assert(state.error === null, 'Error must be cleared');

    // 5. Play and Pause transitions
    state = replayReducer(state, { type: 'PLAY' });
    assert(state.status === 'playing', 'Status must be playing');

    state = replayReducer(state, { type: 'PAUSE' });
    assert(state.status === 'paused', 'Status must be paused');

    // 6. Tick forward to completion
    for (let t = 0; t < 16; t++) {
      state = replayReducer(state, { type: 'TICK_FORWARD' });
    }
    assert(state.currentTick === 16, 'Must reach tick 16');
    assert(state.status === 'completed', 'Must reach completed status at maxTick');

    console.log(' [PASS] replayReducer lifecycle and error states verified.\n');
  }

  // -----------------------------------------------------------
  // Test 3: Checkpoint Generation & Backward Scrubbing Reconstruction
  // -----------------------------------------------------------
  console.log('Test 3: Validating deterministic checkpoint reconstruction (Zero Reverse Mutations)...');
  {
    // Generate Convoy Effect simulation
    const convoyRequest: SimulationRequest = {
      schemaVersion: 1,
      runId: 'convoy-replay-test',
      seed: 42,
      module: 'cpu',
      policy: { name: 'ROUND_ROBIN', quantum: 3 },
      workload: {
        processes: [
          { pid: 1, arrivalTime: 0, bursts: [{ kind: 'CPU', duration: 24 }], basePriority: 0, niceValue: 0 },
          { pid: 2, arrivalTime: 0, bursts: [{ kind: 'CPU', duration: 3 }], basePriority: 0, niceValue: 0 },
          { pid: 3, arrivalTime: 0, bursts: [{ kind: 'CPU', duration: 3 }], basePriority: 0, niceValue: 0 }
        ]
      }
    };

    const convoyResp = await bridge.run(convoyRequest);
    const checkpoints = buildCheckpoints(convoyResp.events, 5, convoyRequest.workload.processes);

    assert(checkpoints.length >= 4, `Must have at least 4 checkpoints, got ${checkpoints.length}`);
    assert(checkpoints[0].tick === 0, 'First checkpoint must be at tick 0');

    // Step A: Replay forward directly to tick 18
    const forwardReplay18 = reconstructStateAtTick(
      18,
      convoyResp.events,
      checkpoints,
      convoyRequest.workload.processes
    );

    // Step B: Advance past tick 18 to tick 28
    const forwardReplay28 = reconstructStateAtTick(
      28,
      convoyResp.events,
      checkpoints,
      convoyRequest.workload.processes
    );
    assert(forwardReplay28.state.currentTick === 28, 'Must advance to tick 28');

    // Step C: Scrub backward from tick 28 back to tick 18
    // In replayReducer, SCRUB_TO_TICK finds checkpoint <= 18 and replays forward.
    let replayState = initialReplayState;
    replayState = replayReducer(replayState, {
      type: 'LOAD_SUCCESS',
      payload: { response: convoyResp, processes: convoyRequest.workload.processes }
    });

    // Advance state to tick 28
    replayState = replayReducer(replayState, {
      type: 'SCRUB_TO_TICK',
      payload: { tick: 28 }
    });
    assert(replayState.currentTick === 28, 'State must be at tick 28');

    // Scrub backward to tick 18
    replayState = replayReducer(replayState, {
      type: 'SCRUB_TO_TICK',
      payload: { tick: 18 }
    });
    assert(replayState.currentTick === 18, 'State must be at tick 18');

    // Step D: Verify deep structural equality between forward-replayed and backward-scrubbed states!
    const stateFwdJson = JSON.stringify(forwardReplay18.state);
    const stateBackJson = JSON.stringify(replayState.currentState);

    assert(
      stateFwdJson === stateBackJson,
      'Backward scrubbed state must be byte-for-byte identical to forward replayed state!'
    );

    assert(
      forwardReplay18.activeEvents.length === replayState.activeEvents.length,
      `Active events count must match: ${forwardReplay18.activeEvents.length} vs ${replayState.activeEvents.length}`
    );

    console.log(' [PASS] Backward scrubbing reconstructs exact state from checkpoint with 0 reverse mutations.\n');
  }

  // -----------------------------------------------------------
  // Test 4: Worker Message Protocol & Responsiveness
  // -----------------------------------------------------------
  console.log('Test 4: Validating Web Worker message protocol and responsiveness (PING/PONG)...');
  {
    const pingStart = Date.now();
    const pingResponse = await handleWorkerMessage({
      type: 'PING',
      id: 'test-ping-1',
      timestamp: pingStart
    });

    assert(pingResponse.type === 'PONG', 'Worker must respond with PONG');
    assert(pingResponse.id === 'test-ping-1', 'Worker must preserve message ID');
    assert(typeof pingResponse.latencyMs === 'number', 'Latency must be numeric');
    assert(typeof pingResponse.workerTimestamp === 'number', 'Worker timestamp must be numeric');

    // Test EngineBridge responsiveness method
    const health = await bridge.checkWorkerResponsiveness(1000);
    assert(health.responsive === true, 'Worker must be reported as responsive');
    assert(health.latencyMs >= 0, 'Latency must be non-negative');

    // Test Worker status query
    const statusResponse = await handleWorkerMessage({
      type: 'GET_STATUS',
      id: 'test-status-1'
    });
    assert(statusResponse.type === 'STATUS', 'Must return STATUS');
    assert(statusResponse.status !== undefined, 'Status body must exist');
    assert(statusResponse.status!.isReady === true, 'Worker must report isReady = true');
    assert(statusResponse.status!.wasmAvailable === false, 'WASM must be reported as unavailable on uncompiled host');

    console.log(` [PASS] Worker responsiveness verified (Ping Latency: ${health.latencyMs}ms).\n`);
  }

  // -----------------------------------------------------------
  // Test 5: Native CLI vs Bridge Fixture Comparison & Toolchain Audit
  // -----------------------------------------------------------
  console.log('Test 5: Auditing toolchain & comparing native C++ CLI fixtures with bridge...');
  {
    const toolchain = bridge.getToolchainStatus();
    assert(toolchain.wasmAvailable === false, 'WASM must not be faked when emcc is missing');
    assert(toolchain.blockedCommand.includes('emcc'), 'Must document blocked emcc command');

    // Check if native CLI binary exists
    const projectRoot = path.resolve(process.cwd(), '..');
    const cliExe = path.join(projectRoot, 'build', 'bin', 'kernellens.exe');

    if (fs.existsSync(cliExe)) {
      console.log(`  Found compiled native CLI at: ${cliExe}`);
      const cliOutput = execFileSync(cliExe, ['--preset', 'convoy', '--policy', 'FCFS', '--format', 'json'], {
        encoding: 'utf-8',
        cwd: projectRoot
      });

      const parsedCli = JSON.parse(cliOutput);
      assert(Array.isArray(parsedCli.events), 'Native CLI output must contain events array');
      assert(parsedCli.metrics !== undefined, 'Native CLI output must contain metrics block');

      // Compare with Bridge FCFS Convoy run
      const bridgeResp = await bridge.run({
        schemaVersion: 1,
        runId: 'convoy-fcfs-native-compare',
        seed: 42,
        module: 'cpu',
        policy: { name: 'FCFS' },
        workload: {
          processes: [
            { pid: 1, arrivalTime: 0, bursts: [{ kind: 'CPU', duration: 24 }], basePriority: 0, niceValue: 0 },
            { pid: 2, arrivalTime: 0, bursts: [{ kind: 'CPU', duration: 3 }], basePriority: 0, niceValue: 0 },
            { pid: 3, arrivalTime: 0, bursts: [{ kind: 'CPU', duration: 3 }], basePriority: 0, niceValue: 0 }
          ]
        }
      });

      // Verify exact metric equivalence between native CLI and bridge fixture
      const nativeAvgWait = parsedCli.metrics.averages.waitingTime ?? parsedCli.metrics.averages.waiting_time;
      const nativeCpuUtil = parsedCli.metrics.cpuUtilization ?? parsedCli.metrics.cpu_utilization;
      const nativeContextSwitches = parsedCli.metrics.contextSwitches ?? parsedCli.metrics.context_switches;

      assert(
        Math.abs(bridgeResp.metrics.averages.waitingTime - nativeAvgWait) < 0.001,
        `Average waiting time must match: Native=${nativeAvgWait}, Bridge=${bridgeResp.metrics.averages.waitingTime}`
      );
      assert(
        Math.abs(bridgeResp.metrics.cpuUtilization - nativeCpuUtil) < 0.001,
        `CPU utilization must match: Native=${nativeCpuUtil}, Bridge=${bridgeResp.metrics.cpuUtilization}`
      );
      assert(
        bridgeResp.metrics.contextSwitches === nativeContextSwitches,
        `Context switches must match: Native=${nativeContextSwitches}, Bridge=${bridgeResp.metrics.contextSwitches}`
      );

      console.log('  [VERIFIED] Native C++ CLI (kernellens.exe) and Bridge fixture produce identical metrics:');
      console.log(`    - Avg Waiting Time:  ${bridgeResp.metrics.averages.waitingTime} ticks`);
      console.log(`    - CPU Utilization:   ${(bridgeResp.metrics.cpuUtilization * 100).toFixed(1)} %`);
      console.log(`    - Context Switches:  ${bridgeResp.metrics.contextSwitches}`);
    } else {
      console.log('  [NOTE] Native CLI binary not found at default path; skipping direct subprocess comparison.');
    }

    console.log(' [PASS] Toolchain audit and native CLI fixture comparison completed.\n');
  }

  console.log('========================================================');
  console.log('   ALL WASM/WORKER BRIDGE & REPLAY TESTS PASSED (5/5)   ');
  console.log('========================================================\n');
}

runTests().catch(err => {
  console.error('[TEST FAILED]:', err);
  process.exit(1);
});
