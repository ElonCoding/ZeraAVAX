/**
 * Command: batch execute
 * Registers payroll batch on PrivatePayroll contract, executes private transfers via eERC adapter,
 * confirms batch on-chain, and displays execution receipts.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { Command } from "commander";
import {
  createPublicClient,
  createWalletClient,
  http,
  PublicClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  batchManifestSchema,
  BatchManifest,
  BatchStatus,
  PayrollBatch,
  evmAddressSchema,
} from "@cashlayer/shared";
import { BabyJub } from "@cashlayer/eerc-adapter";
import {
  DEFAULT_CONTRACT_ADDRESSES,
  PRIVATE_PAYROLL_ABI,
} from "../contracts.js";
import {
  isMockRpc,
  getSimulatedState,
  resolveAdapter,
} from "../adapters.js";

export interface ExecuteBatchOptions {
  batch: string;
  key: string;
  rpc?: string;
  payroll?: string;
  token?: string;
  output?: string;
  mock?: boolean;
  silent?: boolean;
}

export interface BatchExecutionReceipt {
  batchId: `0x${string}`;
  employerAddress: `0x${string}`;
  tokenAddress: `0x${string}`;
  employeeCount: number;
  status: "Confirmed";
  totalGrossAmount: string;
  rosterCommitment: `0x${string}`;
  txHashes: `0x${string}`[];
  confirmedAt: number;
}

export async function executeBatch(options: ExecuteBatchOptions): Promise<BatchExecutionReceipt> {
  if (!options.batch) {
    throw new Error("CLI Error: Batch manifest path or JSON is required (--batch)");
  }
  if (!options.key) {
    throw new Error("CLI Error: Employer private key is required (--key)");
  }

  // 1. Parse Private Key
  const rawKey = options.key.trim();
  const hexKey = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as `0x${string}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(hexKey)) {
    throw new Error("CLI Error: Invalid private key format: must be 32-byte hex string (0x...)");
  }
  const account = privateKeyToAccount(hexKey);
  const employerAddress = account.address.toLowerCase() as `0x${string}`;

  // 2. Load Manifest
  let manifestRaw = "";
  if (fs.existsSync(options.batch)) {
    manifestRaw = fs.readFileSync(options.batch, "utf-8");
  } else if (options.batch.trim().startsWith("{")) {
    manifestRaw = options.batch;
  } else {
    throw new Error(`CLI Error: Batch manifest file not found: ${options.batch}`);
  }

  const manifestParsed = JSON.parse(manifestRaw);
  batchManifestSchema.parse(manifestParsed);
  const manifest = manifestParsed as BatchManifest;

  const tokenAddress = options.token
    ? evmAddressSchema.parse(options.token)
    : manifest.tokenAddress;
  const payrollAddress = options.payroll
    ? evmAddressSchema.parse(options.payroll)
    : DEFAULT_CONTRACT_ADDRESSES.privatePayroll;

  const totalRequired = BigInt(manifest.totalGrossAmount);
  const mockMode = isMockRpc(options.rpc, options.mock);

  let txHashes: `0x${string}`[] = [];

  if (mockMode) {
    const sim = getSimulatedState();
    sim.mockAdapter.tokenAddress = tokenAddress;

    // Ensure employer account registered and funded in mock adapter
    const mockSenderAddr = `0x${hexKey.slice(2, 42).padEnd(40, "0")}`.toLowerCase() as `0x${string}`;
    const empSk = BabyJub.deriveSecretKey(hexKey);
    const empPk = BabyJub.generatePublicKey(empSk);
    sim.mockAdapter.registerAccountExplicit(employerAddress, empSk, empPk);
    sim.mockAdapter.registerAccountExplicit(mockSenderAddr, empSk, empPk);

    // Ensure recipient accounts registered in mock adapter
    for (let i = 0; i < manifest.recipients.length; i++) {
      const recAddr = manifest.recipients[i].address.toLowerCase() as `0x${string}`;
      if (!sim.mockAdapter.getRegisteredPublicKey(recAddr)) {
        const recSk = BigInt(20000001 + i * 10000000);
        const recPk = BabyJub.generatePublicKey(recSk);
        sim.mockAdapter.registerAccountExplicit(recAddr, recSk, recPk);
      }
    }

    // Set balance if insufficient
    const currentBal = (await sim.mockAdapter.getEncryptedBalance(mockSenderAddr, empSk.toString())).decrypted ?? 0n;
    if (currentBal < totalRequired) {
      sim.mockAdapter.setBalance(employerAddress, totalRequired + 100000000n);
      sim.mockAdapter.setBalance(mockSenderAddr, totalRequired + 100000000n);
    }

    // 1. Create batch in simulated contract storage
    const existing = sim.batches.get(manifest.batchId);
    if (existing && existing.status === BatchStatus.Confirmed) {
      throw new Error(`CLI Error: PrivatePayroll: Batch ${manifest.batchId} is already confirmed (Idempotency violation)`);
    }

    const batchRecord: PayrollBatch = {
      batchId: manifest.batchId,
      employer: employerAddress,
      eercToken: tokenAddress,
      employeeCount: manifest.employeeCount,
      status: BatchStatus.Ready,
      rosterCommitment: manifest.rosterCommitment,
      createdAt: BigInt(Date.now()),
      confirmedAt: 0n,
    };
    sim.batches.set(manifest.batchId, batchRecord);

    // 2. Execute transfers via adapter
    const transfers = manifest.recipients.map((r) => ({
      recipient: r.address,
      amount: BigInt(r.amount),
    }));

    const execRes = await sim.mockAdapter.executeBatchTransfers({
      batchId: manifest.batchId,
      transfers,
      senderPrivateKey: hexKey,
    });
    txHashes = execRes.txHashes;

    // 3. Confirm batch on-chain
    batchRecord.status = BatchStatus.Confirmed;
    batchRecord.confirmedAt = BigInt(Date.now());
  } else {
    // Live RPC Mode
    const publicClient = createPublicClient({
      transport: http(options.rpc),
    }) as unknown as PublicClient;

    const walletClient = createWalletClient({
      account,
      transport: http(options.rpc),
    });

    const liveAdapter = await resolveAdapter({
      rpc: options.rpc,
      token: tokenAddress,
    });

    // Check if batch already exists on PrivatePayroll
    let batchExists = false;
    try {
      const onChainBatch = (await publicClient.readContract({
        address: payrollAddress,
        abi: PRIVATE_PAYROLL_ABI,
        functionName: "getBatch",
        args: [manifest.batchId],
      })) as any;
      if (onChainBatch && onChainBatch.status !== 0) {
        batchExists = true;
        if (onChainBatch.status === BatchStatus.Confirmed) {
          throw new Error(`CLI Error: Batch ${manifest.batchId} already executed on-chain`);
        }
      }
    } catch (e: any) {
      if (e.message?.includes("already executed")) throw e;
      batchExists = false;
    }

    if (!batchExists) {
      const createTx = await walletClient.writeContract({
        chain: null,
        address: payrollAddress,
        abi: PRIVATE_PAYROLL_ABI,
        functionName: "createPayrollBatch",
        args: [
          manifest.batchId,
          tokenAddress,
          manifest.employeeCount,
          manifest.rosterCommitment,
        ],
      });
      await publicClient.waitForTransactionReceipt({ hash: createTx });

      const readyTx = await walletClient.writeContract({
        chain: null,
        address: payrollAddress,
        abi: PRIVATE_PAYROLL_ABI,
        functionName: "markBatchReady",
        args: [manifest.batchId],
      });
      await publicClient.waitForTransactionReceipt({ hash: readyTx });

      const submitTx = await walletClient.writeContract({
        chain: null,
        address: payrollAddress,
        abi: PRIVATE_PAYROLL_ABI,
        functionName: "submitBatch",
        args: [manifest.batchId],
      });
      await publicClient.waitForTransactionReceipt({ hash: submitTx });
    }

    // Execute private transfers
    const transfers = manifest.recipients.map((r) => ({
      recipient: r.address,
      amount: BigInt(r.amount),
    }));

    const execRes = await liveAdapter.executeBatchTransfers({
      batchId: manifest.batchId,
      transfers,
      senderPrivateKey: hexKey,
    });
    txHashes = execRes.txHashes;

    // Confirm batch execution
    const confirmTx = await walletClient.writeContract({
      chain: null,
      address: payrollAddress,
      abi: PRIVATE_PAYROLL_ABI,
      functionName: "confirmBatchExecution",
      args: [manifest.batchId, manifest.employeeCount],
    });
    await publicClient.waitForTransactionReceipt({ hash: confirmTx });
    txHashes.push(confirmTx);
  }

  const receipt: BatchExecutionReceipt = {
    batchId: manifest.batchId,
    employerAddress,
    tokenAddress,
    employeeCount: manifest.employeeCount,
    status: "Confirmed",
    totalGrossAmount: manifest.totalGrossAmount,
    rosterCommitment: manifest.rosterCommitment,
    txHashes,
    confirmedAt: Date.now(),
  };

  // Output to file if specified
  if (options.output) {
    const resolvedPath = path.resolve(process.cwd(), options.output);
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(resolvedPath, JSON.stringify(receipt, null, 2), "utf-8");
  }

  // Console display
  if (!options.silent) {
    console.log("\n=======================================================");
    console.log("   CashLayer Private Payroll — Batch Execution Receipt");
    console.log("=======================================================");
    console.log(`Batch ID:          ${receipt.batchId}`);
    console.log(`Employer Address:  ${receipt.employerAddress}`);
    console.log(`Status:            ${receipt.status} (Smart Contract State 4)`);
    console.log(`Disbursed Total:   ${receipt.totalGrossAmount} units`);
    console.log(`Employees Paid:    ${receipt.employeeCount}`);
    console.log(`Tx Hashes:         ${receipt.txHashes.length} transactions mined`);
    for (let i = 0; i < Math.min(receipt.txHashes.length, 3); i++) {
      console.log(`  - [${i + 1}] ${receipt.txHashes[i]}`);
    }
    if (receipt.txHashes.length > 3) {
      console.log(`  ... and ${receipt.txHashes.length - 3} more`);
    }
    if (options.output) {
      console.log(`Receipt File:      ${options.output}`);
    }
    console.log("-------------------------------------------------------");
    console.log(`✔ Payroll batch executed and confirmed on-chain successfully.\n`);
  }

  return receipt;
}

export function registerExecuteCommand(program: Command): void {
  program
    .command("execute")
    .description("Execute confidential payroll batch on-chain and confirm status in PrivatePayroll")
    .requiredOption("-b, --batch <path-or-json>", "Path to batch manifest JSON file or manifest string")
    .requiredOption("-k, --key <privateKey>", "Employer EVM private key (0x...)")
    .option("--rpc <url>", "Avalanche RPC URL or 'mock'", "mock")
    .option("-p, --payroll <address>", "PrivatePayroll coordinator contract address")
    .option("-t, --token <address>", "Confidential token contract address")
    .option("-o, --output <file>", "Output file path to save execution receipts")
    .option("-m, --mock", "Force offline simulation mode")
    .option("-s, --silent", "Suppress console output")
    .action(async (opts) => {
      try {
        await executeBatch(opts);
      } catch (err: any) {
        console.error(`\n❌ Batch execution failed: ${err.message || err}`);
        process.exitCode = 1;
      }
    });
}
