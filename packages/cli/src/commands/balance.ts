/**
 * Command: employee balance
 * Queries an employee's confidential balance, decrypts locally via BabyJubjub viewing key,
 * and displays confidential balance with strict zero-leakage of organization or peer figures.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { Command } from "commander";
import { evmAddressSchema } from "@cashlayer/shared";
import { BabyJub } from "@cashlayer/eerc-adapter";
import { DEFAULT_CONTRACT_ADDRESSES } from "../contracts.js";
import { isMockRpc, getSimulatedState, resolveAdapter } from "../adapters.js";

export interface EmployeeBalanceOptions {
  employee: string;
  viewingKey: string;
  rpc?: string;
  token?: string;
  output?: string;
  mock?: boolean;
  silent?: boolean;
}

export interface EmployeeBalanceResult {
  employeeAddress: `0x${string}`;
  decryptedBalance: string;
  encryptedHandle: [string, string, string, string];
  timestamp: number;
}

export async function getEmployeeBalance(options: EmployeeBalanceOptions): Promise<EmployeeBalanceResult> {
  if (!options.employee) {
    throw new Error("CLI Error: Employee address is required (--employee)");
  }
  if (!options.viewingKey) {
    throw new Error("CLI Error: Employee viewing key is required (--viewing-key)");
  }

  // 1. Validate Employee EVM Address
  const employeeAddress = evmAddressSchema.parse(options.employee);

  // 2. Normalize Viewing Key
  let viewingKey = options.viewingKey.trim();
  if (viewingKey.startsWith("0x")) {
    try {
      viewingKey = BigInt(viewingKey).toString();
    } catch {
      throw new Error("CLI Error: Malformed viewing key");
    }
  }

  const tokenAddress = options.token
    ? evmAddressSchema.parse(options.token)
    : DEFAULT_CONTRACT_ADDRESSES.eercToken;

  const mockMode = isMockRpc(options.rpc, options.mock);

  let encHandle: [bigint, bigint, bigint, bigint];
  let decrypted: bigint | undefined;

  if (mockMode) {
    const sim = getSimulatedState();
    sim.mockAdapter.tokenAddress = tokenAddress;
    if (!sim.mockAdapter.getRegisteredPublicKey(employeeAddress) && viewingKey) {
      try {
        const sk = BigInt(viewingKey);
        const pk = BabyJub.generatePublicKey(sk);
        sim.mockAdapter.registerAccountExplicit(employeeAddress, sk, pk);
      } catch {
        // ignore malformed keys
      }
    }
    const res = await sim.mockAdapter.getEncryptedBalance(employeeAddress, viewingKey);
    encHandle = res.encrypted;
    decrypted = res.decrypted;
  } else {
    const adapter = await resolveAdapter({
      rpc: options.rpc,
      token: tokenAddress,
    });
    const res = await adapter.getEncryptedBalance(employeeAddress, viewingKey);
    encHandle = res.encrypted;
    decrypted = res.decrypted;
  }

  if (decrypted === undefined) {
    throw new Error("CLI Error: Failed to decrypt balance with provided viewing key");
  }

  const result: EmployeeBalanceResult = {
    employeeAddress,
    decryptedBalance: decrypted.toString(),
    encryptedHandle: [
      encHandle[0].toString(),
      encHandle[1].toString(),
      encHandle[2].toString(),
      encHandle[3].toString(),
    ],
    timestamp: Math.floor(Date.now() / 1000),
  };

  // Output to file if specified
  if (options.output) {
    const resolvedPath = path.resolve(process.cwd(), options.output);
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(resolvedPath, JSON.stringify(result, null, 2), "utf-8");
  }

  // Console output (Guarantees zero leak of organization or peer figures)
  if (!options.silent) {
    console.log("\n=======================================================");
    console.log("   CashLayer Private Payroll — Employee Balance Portal");
    console.log("=======================================================");
    console.log(`Employee Address:    ${result.employeeAddress}`);
    console.log(`Confidential Balance: ${result.decryptedBalance} units (Decrypted Locally)`);
    console.log(`Ciphertext Handle:   [${result.encryptedHandle[0].slice(0, 10)}..., ${result.encryptedHandle[2].slice(0, 10)}...]`);
    console.log(`Privacy Guarantee:   Zero-Leak (Org totals & peer salaries hidden)`);
    if (options.output) {
      console.log(`Output File:         ${options.output}`);
    }
    console.log("-------------------------------------------------------");
    console.log(`✔ Confidential balance decrypted successfully.\n`);
  }

  return result;
}

export function registerBalanceCommand(program: Command): void {
  program
    .command("balance")
    .description("Query and locally decrypt confidential employee token balance")
    .requiredOption("-e, --employee <address>", "Employee EVM wallet address")
    .requiredOption("-v, --viewing-key <key>", "Employee private viewing key (scalar or hex)")
    .option("--rpc <url>", "Avalanche RPC URL or 'mock'", "mock")
    .option("-t, --token <address>", "Confidential token contract address")
    .option("-o, --output <file>", "Output file path to save balance JSON")
    .option("-m, --mock", "Force offline simulation mode")
    .option("-s, --silent", "Suppress console output")
    .action(async (opts) => {
      try {
        await getEmployeeBalance(opts);
      } catch (err: any) {
        console.error(`\n❌ Balance query failed: ${err.message || err}`);
        process.exitCode = 1;
      }
    });
}
