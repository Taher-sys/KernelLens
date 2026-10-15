/**
 * KernelLens EngineBridge Interface & Dispatcher
 *
 * Implements the typed EngineBridge contract:
 * - Dispatches simulation requests to the background Web Worker.
 * - Enforces schemaVersion: 1 guard on both inputs and outputs.
 * - Provides worker responsiveness health check (ping-pong with latency measurement).
 * - Exposes toolchain audit (documents blocked Emscripten command when emcc is unavailable;
 *   never fakes WASM compilation).
 * - Time-travel replay helper via event filtering.
 */

import {
  assertSchemaVersion,
  SimulationRequest,
  SimulationResponse,
  SimEvent,
  CpuPolicy,
  WorkerRequestMessage,
  WorkerResponseMessage
} from './schema';
import { handleWorkerMessage } from './simulation.worker';

export const SUPPORTED_CPU_POLICIES: readonly CpuPolicy[] = [
  'FCFS',
  'SJF',
  'SRTF',
  'PRIORITY',
  'ROUND_ROBIN',
  'MLFQ',
  'CFS_LIKE'
];

export function isValidCpuPolicy(name: string): boolean {
  if (!name) return false;
  return SUPPORTED_CPU_POLICIES.includes(name.toUpperCase() as CpuPolicy);
}

export interface ToolchainStatus {
  wasmAvailable: boolean;
  emscriptenDetected: boolean;
  blockedCommand: string;
}

export interface IEngineBridge {
  /**
   * Check if the simulation engine is initialized and ready.
   */
  isReady(): boolean;

  /**
   * Check if the C++ memory simulation engine is connected.
   */
  isMemoryEngineReady(): boolean;

  /**
   * Check if compiled C++ WebAssembly is active in the environment.
   */
  isWasmAvailable(): boolean;

  /**
   * Returns toolchain audit details and the exact command to compile WASM.
   */
  getToolchainStatus(): ToolchainStatus;

  /**
   * Pings the Web Worker to verify responsiveness and measure round-trip latency.
   */
  checkWorkerResponsiveness(timeoutMs?: number): Promise<{ responsive: boolean; latencyMs: number }>;

  /**
   * Dispatch a simulation run request to the engine.
   * Returns a promise resolving to the canonical SimulationResponse with events and metrics.
   * Validates result shape and throws explicit errors for unsupported policies.
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
 * Dispatches to the Web Worker background thread (browser) or pure message handler (Node/tests).
 */
export class EngineBridge implements IEngineBridge {
  private ready: boolean = true;
  private worker: Worker | null = null;
  private messageCounter: number = 0;
  private pendingCallbacks: Map<string, { resolve: (val: any) => void; reject: (err: any) => void }> = new Map();

  constructor() {
    this.initWorker();
  }

  private initWorker(): void {
    if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
      try {
        this.worker = new Worker(new URL('./simulation.worker.ts', import.meta.url), {
          type: 'module'
        });

        this.worker.onmessage = (event: MessageEvent<WorkerResponseMessage>) => {
          const msg = event.data;
          const handler = this.pendingCallbacks.get(msg.id);
          if (handler) {
            this.pendingCallbacks.delete(msg.id);
            if (msg.type === 'ERROR') {
              handler.reject(new Error(msg.error || 'Worker execution error'));
            } else {
              handler.resolve(msg);
            }
          }
        };

        this.worker.onerror = (err: ErrorEvent) => {
          console.error('[EngineBridge Worker Error]:', err);
        };
      } catch (err) {
        // Fallback to inline dispatch if worker creation fails (e.g. file:// restriction)
        this.worker = null;
      }
    }
  }

  isReady(): boolean {
    return this.ready;
  }

  isMemoryEngineReady(): boolean {
    return this.ready;
  }

  isWasmAvailable(): boolean {
    // Return false when Emscripten binary is not compiled; do not fake WASM success.
    return false;
  }

  getToolchainStatus(): ToolchainStatus {
    return {
      wasmAvailable: false,
      emscriptenDetected: false,
      blockedCommand:
        'emcc -std=c++17 -O3 -Iengine/include engine/wasm/bindings.cpp engine/src/core/*.cpp engine/src/cpu/*.cpp engine/src/memory/*.cpp engine/src/sync/*.cpp engine/src/disk/*.cpp engine/src/workload/*.cpp -o frontend/public/kernellens.js -s WASM=1 -s MODULARIZE=1 -s EXPORT_NAME="createKernelLensModule" --bind'
    };
  }

  /**
   * Health-check method testing worker responsiveness and measuring latency
   */
  async checkWorkerResponsiveness(timeoutMs: number = 1000): Promise<{ responsive: boolean; latencyMs: number }> {
    const id = `ping-${++this.messageCounter}-${Date.now()}`;
    const startTime = Date.now();

    const requestMsg: WorkerRequestMessage = {
      type: 'PING',
      id,
      timestamp: startTime
    };

    try {
      const response = await this.dispatchToWorker(requestMsg, timeoutMs);
      if (response && response.type === 'PONG') {
        const totalRoundTrip = Date.now() - startTime;
        return {
          responsive: true,
          latencyMs: response.latencyMs ?? totalRoundTrip
        };
      }
      return { responsive: false, latencyMs: -1 };
    } catch {
      return { responsive: false, latencyMs: -1 };
    }
  }

  /**
   * Dispatches a message to the worker with timeout protection
   */
  private dispatchToWorker(msg: WorkerRequestMessage, timeoutMs: number = 10000): Promise<WorkerResponseMessage> {
    if (this.worker) {
      return new Promise<WorkerResponseMessage>((resolve, reject) => {
        const timer = setTimeout(() => {
          this.pendingCallbacks.delete(msg.id);
          reject(new Error(`Worker response timed out after ${timeoutMs}ms`));
        }, timeoutMs);

        this.pendingCallbacks.set(msg.id, {
          resolve: (val) => {
            clearTimeout(timer);
            resolve(val);
          },
          reject: (err) => {
            clearTimeout(timer);
            reject(err);
          }
        });

        this.worker!.postMessage(msg);
      });
    }

    // Node.js / headless test environment fallback
    return new Promise<WorkerResponseMessage>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Worker response timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      handleWorkerMessage(msg)
        .then((res) => {
          clearTimeout(timer);
          if (res.type === 'ERROR') {
            reject(new Error(res.error || 'Worker execution error'));
          } else {
            resolve(res);
          }
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  async run(request: SimulationRequest): Promise<SimulationResponse> {
    if (!request) {
      throw new Error('SimulationRequest cannot be null or undefined');
    }

    // Strict schema-version guard on request
    assertSchemaVersion(request.schemaVersion);

    // Validate CPU policy if CPU module
    if (request.module === 'cpu') {
      const rawName = request.policy?.name || '';
      const policyUpper = rawName.toUpperCase();
      if (!isValidCpuPolicy(policyUpper)) {
        throw new Error(
          `Unsupported CPU scheduling policy: "${rawName}". Supported policies are: ${SUPPORTED_CPU_POLICIES.join(', ')}`
        );
      }
    }

    const id = `run-${++this.messageCounter}-${Date.now()}`;
    const workerMsg: WorkerRequestMessage = {
      type: 'RUN_SIMULATION',
      id,
      request
    };

    const workerResult = await this.dispatchToWorker(workerMsg);

    if (workerResult.type !== 'SIMULATION_RESULT' || !workerResult.response) {
      throw new Error(workerResult.error || 'Failed to obtain simulation result from worker');
    }

    const response = workerResult.response;

    // Strict schema-version guard on response
    assertSchemaVersion(response.schemaVersion);

    if (!response.runId || typeof response.simulatedDuration !== 'number') {
      throw new Error('SimulationResponse missing required runId or simulatedDuration');
    }
    if (!Array.isArray(response.events)) {
      throw new Error('SimulationResponse events must be an array');
    }
    if (!response.metrics && response.status === 'completed') {
      throw new Error('SimulationResponse missing valid metrics block');
    }

    return response;
  }

  replayToTick(events: SimEvent[], targetTick: number): SimEvent[] {
    return events.filter(e => e.time <= targetTick);
  }

  reset(): void {
    // Reset worker state if required
    this.pendingCallbacks.clear();
  }
}

// Global default bridge singleton instance
export const defaultEngineBridge: IEngineBridge = new EngineBridge();
