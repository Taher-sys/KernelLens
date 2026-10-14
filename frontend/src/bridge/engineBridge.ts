/**
 * KernelLens EngineBridge Interface Stub
 * Contract defined in docs/architecture.md:
 * "typed EngineBridge contract: JSON request / JSON result / NDJSON events"
 */

import { SimulationRequest, SimulationResponse, SimEvent } from './schema';
import { runCpuSimulation, runMemorySimulation, runDiskSimulation } from './simulationBridge';

export interface IEngineBridge {
  /**
   * Check if the simulation engine is initialized and ready.
   */
  isReady(): boolean;

  /**
   * Dispatch a simulation run request to the engine.
   * Returns a promise resolving to the canonical SimulationResponse with events and metrics.
   */
  run(request: SimulationRequest): Promise<SimulationResponse>;

  /**
   * Replay an event stream up to a specific simulated tick.
   */
  replayToTick(events: SimEvent[], targetTick: number): SimEvent[];

  /**
   * Reset simulation state.
   */
  reset(): void;
}

/**
 * Concrete EngineBridge implementation.
 * Dispatches to the deterministic discrete-event engine (in-browser client engine / WebAssembly).
 */
export class EngineBridge implements IEngineBridge {
  private ready: boolean = true;

  isReady(): boolean {
    return this.ready;
  }

  async run(request: SimulationRequest): Promise<SimulationResponse> {
    if (request.module === 'cpu') {
      const policyName = request.policy.name.toUpperCase() as any;
      const response = runCpuSimulation(
        request.workload.processes,
        policyName,
        {
          quantum: request.policy.quantum ?? request.options?.quantum ?? 3,
          preemptive: request.options?.preemptive,
          agingInterval: request.options?.agingInterval,
          contextSwitchCost: request.options?.contextSwitchCost
        }
      );
      return response;
    }

    if (request.module === 'memory') {
      const policyName = request.policy.name.toUpperCase() as any;
      const refString = request.workload.processes as any || [];
      const numFrames = request.options?.quantum ?? 4;
      const result = runMemorySimulation(refString, numFrames, policyName, 4);
      return {
        schemaVersion: 1,
        runId: `mem-${policyName.toLowerCase()}`,
        status: 'completed',
        simulatedDuration: refString.length,
        events: result.events,
        metrics: {
          perProcess: [],
          averages: {
            waitingTime: 0,
            turnaroundTime: 0,
            responseTime: 0
          },
          throughput: result.metrics.totalAccesses / Math.max(1, refString.length),
          cpuUtilization: 1.0,
          contextSwitches: 0,
          jainFairness: null
        }
      };
    }

    if (request.module === 'disk') {
      const policyName = request.policy.name.toUpperCase() as any;
      const requests = request.workload.processes as any || [];
      const result = runDiskSimulation(requests, 53, policyName, 199, 'UP');
      return {
        schemaVersion: 1,
        runId: `disk-${policyName.toLowerCase()}`,
        status: 'completed',
        simulatedDuration: requests.length,
        events: result.events,
        metrics: {
          perProcess: [],
          averages: {
            waitingTime: result.totalSeekDistance / Math.max(1, requests.length),
            turnaroundTime: result.totalSeekDistance,
            responseTime: 0
          },
          throughput: requests.length / Math.max(1, result.totalSeekDistance),
          cpuUtilization: 1.0,
          contextSwitches: 0,
          jainFairness: null
        }
      };
    }

    throw new Error(`Unsupported subsystem module: ${request.module}`);
  }

  replayToTick(events: SimEvent[], targetTick: number): SimEvent[] {
    return events.filter(e => e.time <= targetTick);
  }

  reset(): void {
    // Reset internal buffers
  }
}

// Global default bridge singleton instance
export const defaultEngineBridge: IEngineBridge = new EngineBridge();
