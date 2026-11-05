/**
 * Adapter management and RPC connection factory for CashLayer Private Payroll CLI.
 * Supports both high-speed offline simulation (MockEERCAdapter) and live Avalanche RPC (LiveEERCAdapter).
 */

import {
  IEERCAdapter,
  MockEERCAdapter,
  LiveEERCAdapter,
  BabyJub,
} from "@cashlayer/eerc-adapter";
import { PayrollBatch, ComplianceAttestation } from "@cashlayer/shared";
import { DEFAULT_CONTRACT_ADDRESSES } from "./contracts.js";

export interface SimulatedState {
  batches: Map<`0x${string}`, PayrollBatch>;
  attestations: Map<string, ComplianceAttestation>;
  mockAdapter: MockEERCAdapter;
}

let globalSimState: SimulatedState | null = null;

export function getSimulatedState(): SimulatedState {
  if (!globalSimState) {
    const mockAdapter = new MockEERCAdapter({
      tokenAddress: DEFAULT_CONTRACT_ADDRESSES.eercToken,
      registrarAddress: DEFAULT_CONTRACT_ADDRESSES.registrar,
      auditorAddress: DEFAULT_CONTRACT_ADDRESSES.auditor,
      auditorPK: BabyJub.generatePublicKey(70000001n),
    });

    globalSimState = {
      batches: new Map(),
      attestations: new Map(),
      mockAdapter,
    };
  }
  return globalSimState;
}

export function resetSimulatedState(initialAdapter?: MockEERCAdapter): SimulatedState {
  const mockAdapter =
    initialAdapter ??
    new MockEERCAdapter({
      tokenAddress: DEFAULT_CONTRACT_ADDRESSES.eercToken,
      registrarAddress: DEFAULT_CONTRACT_ADDRESSES.registrar,
      auditorAddress: DEFAULT_CONTRACT_ADDRESSES.auditor,
      auditorPK: BabyJub.generatePublicKey(70000001n),
    });

  globalSimState = {
    batches: new Map(),
    attestations: new Map(),
    mockAdapter,
  };
  return globalSimState;
}

export function isMockRpc(rpc?: string, forceMock?: boolean): boolean {
  if (forceMock) return true;
  if (!rpc) return true;
  const lower = rpc.trim().toLowerCase();
  return (
    lower === "mock" ||
    lower === "sim" ||
    lower === "simulation" ||
    lower === "offline" ||
    lower === "test" ||
    lower === ""
  );
}

export async function resolveAdapter(options: {
  rpc?: string;
  token?: `0x${string}`;
  registrar?: `0x${string}`;
  mock?: boolean;
}): Promise<IEERCAdapter> {
  const tokenAddress = options.token ?? DEFAULT_CONTRACT_ADDRESSES.eercToken;
  const registrarAddress = options.registrar ?? DEFAULT_CONTRACT_ADDRESSES.registrar;

  if (isMockRpc(options.rpc, options.mock)) {
    const state = getSimulatedState();
    state.mockAdapter.tokenAddress = tokenAddress;
    state.mockAdapter.registrarAddress = registrarAddress;
    return state.mockAdapter;
  }

  const live = new LiveEERCAdapter({
    rpcUrl: options.rpc,
    tokenAddress,
    registrarAddress,
  });
  await live.initialize(options.rpc!, tokenAddress, registrarAddress);
  return live;
}
