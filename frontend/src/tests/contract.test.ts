/**
 * KernelLens Frontend Bridge Contract Test
 * Validates CPU result shape according to docs/event-schema.md
 * and tests error handling for unsupported policy names.
 */

import { EngineBridge } from '../bridge/engineBridge';
import { SimulationRequest } from '../bridge/schema';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED]: ${message}`);
  }
}

async function runContractTests() {
  console.log('========================================================');
  console.log('   Running KernelLens Frontend Bridge Contract Tests    ');
  console.log('========================================================\n');

  const bridge = new EngineBridge();

  // Test 1: Valid CPU FCFS result shape
  {
    console.log('Test 1: Validating FCFS SimulationResponse shape...');
    const request: SimulationRequest = {
      schemaVersion: 1,
      runId: 'test-cpu-fcfs',
      seed: 42,
      module: 'cpu',
      policy: { name: 'FCFS' },
      workload: {
        processes: [
          { pid: 1, arrivalTime: 0, bursts: [{ kind: 'CPU', duration: 10 }], basePriority: 0, niceValue: 0 },
          { pid: 2, arrivalTime: 2, bursts: [{ kind: 'CPU', duration: 4 }], basePriority: 0, niceValue: 0 }
        ]
      }
    };

    const response = await bridge.run(request);

    assert(response.schemaVersion === 1, 'schemaVersion must be 1');
    assert(response.status === 'completed', 'status must be completed');
    assert(typeof response.simulatedDuration === 'number', 'simulatedDuration must be a number');
    assert(response.simulatedDuration === 14, `simulatedDuration should be 14, got ${response.simulatedDuration}`);
    assert(Array.isArray(response.events), 'events must be an array');
    assert(response.events.length > 0, 'events array must not be empty');

    // Validate event properties
    for (let i = 0; i < response.events.length; ++i) {
      const ev = response.events[i];
      assert(ev.schemaVersion === 1, `Event ${i} schemaVersion must be 1`);
      assert(ev.seq === i, `Event ${i} seq must be monotonic`);
      assert(typeof ev.time === 'number' && ev.time >= 0, `Event ${i} time must be non-negative integer`);
      assert(ev.subsystem === 'cpu', `Event ${i} subsystem must be 'cpu'`);
      assert(typeof ev.type === 'string' && ev.type.length > 0, `Event ${i} type must be non-empty string`);
      assert(typeof ev.details === 'object' && ev.details !== null, `Event ${i} details must be an object`);
    }

    // Validate metrics shape
    assert(typeof response.metrics === 'object' && response.metrics !== null, 'metrics must be an object');
    assert(Array.isArray(response.metrics.perProcess), 'metrics.perProcess must be an array');
    assert(response.metrics.perProcess.length === 2, 'perProcess must have 2 entries');

    const p1 = response.metrics.perProcess.find(p => p.pid === 1);
    assert(p1 !== undefined, 'PID 1 metric must exist');
    assert(p1!.waitingTime === 0, 'P1 waiting time must be 0 in FCFS');
    assert(p1!.turnaroundTime === 10, 'P1 turnaround time must be 10');

    assert(typeof response.metrics.averages === 'object', 'metrics.averages must be an object');
    assert(typeof response.metrics.averages.waitingTime === 'number', 'averages.waitingTime must be a number');
    assert(typeof response.metrics.averages.turnaroundTime === 'number', 'averages.turnaroundTime must be a number');
    assert(typeof response.metrics.cpuUtilization === 'number', 'cpuUtilization must be a number');
    assert(response.metrics.cpuUtilization === 1.0, 'cpuUtilization should be 1.0 (no idle gaps)');
    assert(typeof response.metrics.contextSwitches === 'number', 'contextSwitches must be a number');

    console.log(' [PASS] FCFS SimulationResponse shape verified.\n');
  }

  // Test 2: Golden Silberschatz Convoy Effect (Round Robin vs FCFS)
  {
    console.log('Test 2: Validating Round Robin Convoy Effect contract...');
    const request: SimulationRequest = {
      schemaVersion: 1,
      runId: 'test-cpu-rr-convoy',
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

    const response = await bridge.run(request);
    assert(response.simulatedDuration === 30, 'Total duration must be 30');
    assert(response.metrics.perProcess.length === 3, 'Must have 3 process metrics');
    assert(Math.abs(response.metrics.averages.waitingTime - 5.0) < 0.001, `Avg wait time should be 5.0, got ${response.metrics.averages.waitingTime}`);

    console.log(' [PASS] Round Robin Convoy metrics contract verified.\n');
  }

  // Test 3: Error handling for unsupported policy names
  {
    console.log('Test 3: Validating error handling for unsupported policy names...');
    const request: SimulationRequest = {
      schemaVersion: 1,
      runId: 'test-invalid-policy',
      seed: 42,
      module: 'cpu',
      policy: { name: 'SUPER_FAST_QUANTUM_AI_SCHEDULER' },
      workload: { processes: [] }
    };

    let errorCaught = false;
    try {
      await bridge.run(request);
    } catch (err: any) {
      errorCaught = true;
      assert(
        err.message.includes('Unsupported CPU scheduling policy'),
        `Error message should mention unsupported policy, got: "${err.message}"`
      );
    }
    assert(errorCaught, 'Bridge must throw an error when given an unsupported policy name');
    console.log(' [PASS] Unsupported policy error correctly rejected.\n');
  }

  // Test 4: Error handling for empty or malformed requests
  {
    console.log('Test 4: Validating error handling for null/empty request...');
    let errorCaught = false;
    try {
      await bridge.run(null as any);
    } catch (err: any) {
      errorCaught = true;
      assert(err.message.includes('SimulationRequest cannot be null'), 'Must reject null request');
    }
    assert(errorCaught, 'Bridge must throw when request is null');
    console.log(' [PASS] Null request correctly rejected.\n');
  }

  // Test 5: All 7 supported CPU policies
  {
    console.log('Test 5: Verifying all 7 supported CPU policies execute...');
    const policies = ['FCFS', 'SJF', 'SRTF', 'PRIORITY', 'ROUND_ROBIN', 'MLFQ', 'CFS_LIKE'];
    const sampleWorkload = [
      { pid: 1, arrivalTime: 0, bursts: [{ kind: 'CPU' as const, duration: 6 }], basePriority: 1, niceValue: 0 },
      { pid: 2, arrivalTime: 1, bursts: [{ kind: 'CPU' as const, duration: 3 }], basePriority: 2, niceValue: -2 }
    ];

    for (const pol of policies) {
      const resp = await bridge.run({
        schemaVersion: 1,
        runId: `test-${pol.toLowerCase()}`,
        seed: 42,
        module: 'cpu',
        policy: { name: pol, quantum: 2 },
        workload: { processes: sampleWorkload }
      });
      assert(resp.status === 'completed', `${pol} must return status completed`);
      assert(resp.events.length > 0, `${pol} must generate events`);
      assert(resp.metrics.perProcess.length === 2, `${pol} must compute metrics for all processes`);
    }
    console.log(` [PASS] All ${policies.length} CPU policies verified.\n`);
  }

  console.log('========================================================');
  console.log('   ALL FRONTEND BRIDGE CONTRACT TESTS PASSED (5/5)      ');
  console.log('========================================================\n');
}

runContractTests().catch(err => {
  console.error('[FAILED]:', err);
  process.exit(1);
});
