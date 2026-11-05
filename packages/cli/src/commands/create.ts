/**
 * Command: batch create
 * Parses roster CSV, validates addresses & amounts, computes cryptographic commitment and deterministic batchId,
 * and outputs batch manifest JSON.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { Command } from "commander";
import {
  parsePayrollCsv,
  batchManifestSchema,
  BatchManifest,
  evmAddressSchema,
} from "@cashlayer/shared";
import { Poseidon } from "@cashlayer/eerc-adapter";
import { DEFAULT_CONTRACT_ADDRESSES } from "../contracts.js";

export interface CreateBatchOptions {
  roster: string;
  token?: string;
  output?: string;
  batchId?: string;
  payroll?: string;
  auditor?: string;
  silent?: boolean;
}

export async function createBatch(options: CreateBatchOptions): Promise<BatchManifest> {
  if (!options.roster || options.roster.trim().length === 0) {
    throw new Error("CLI Error: Roster CSV path or content is required (--roster)");
  }

  // 1. Read CSV content (from file or inline string)
  let csvContent = "";
  if (fs.existsSync(options.roster)) {
    csvContent = fs.readFileSync(options.roster, "utf-8");
  } else if (options.roster.includes("\n") || options.roster.includes(",")) {
    csvContent = options.roster;
  } else {
    throw new Error(`CLI Error: Roster file not found: ${options.roster}`);
  }

  // 2. Parse and validate CSV with @cashlayer/shared
  const parsed = parsePayrollCsv(csvContent);

  // 3. Validate Token Address
  const rawToken = options.token ?? DEFAULT_CONTRACT_ADDRESSES.eercToken;
  const tokenAddress = evmAddressSchema.parse(rawToken);

  // 4. Compute Poseidon Roster Commitment
  const itemHashes = parsed.recipients.map((r) =>
    Poseidon.hash([BigInt(r.recipient), r.amount])
  );
  const commitmentBigInt = Poseidon.hash(itemHashes);
  const rosterCommitment = `0x${commitmentBigInt.toString(16).padStart(64, "0")}` as `0x${string}`;

  // 5. Compute Deterministic Batch ID
  let batchId: `0x${string}`;
  if (options.batchId) {
    const clean = options.batchId.trim();
    const hex = clean.startsWith("0x") ? clean.slice(2) : clean;
    if (!/^[0-9a-fA-F]{1,64}$/.test(hex)) {
      throw new Error(`CLI Error: Invalid batch-id: must be 32-byte hex string`);
    }
    batchId = `0x${hex.padStart(64, "0").toLowerCase()}` as `0x${string}`;
  } else {
    const salt = BigInt(Date.now());
    const derived = Poseidon.hash([
      salt,
      commitmentBigInt,
      BigInt(tokenAddress),
      BigInt(parsed.employeeCount),
    ]);
    batchId = `0x${derived.toString(16).padStart(64, "0")}` as `0x${string}`;
  }

  // 6. Build Manifest conforming to batchManifestSchema
  const manifest: BatchManifest = {
    batchId,
    tokenAddress,
    employeeCount: parsed.employeeCount,
    totalGrossAmount: parsed.totalGrossAmount.toString(),
    rosterCommitment,
    recipients: parsed.recipients.map((r) => ({
      address: r.recipient,
      amount: r.amount.toString(),
      department: r.department,
    })),
    createdAt: new Date().toISOString(),
  };

  // 7. Validate with Zod schema
  batchManifestSchema.parse(manifest);

  // 8. Output to file if specified
  if (options.output) {
    const resolvedPath = path.resolve(process.cwd(), options.output);
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(resolvedPath, JSON.stringify(manifest, null, 2), "utf-8");
  }

  // 9. Console presentation
  if (!options.silent) {
    console.log("\n=======================================================");
    console.log("   CashLayer Private Payroll — Batch Creation Manifest");
    console.log("=======================================================");
    console.log(`Batch ID:          ${manifest.batchId}`);
    console.log(`Token Address:     ${manifest.tokenAddress}`);
    console.log(`Employee Count:    ${manifest.employeeCount}`);
    console.log(`Total Gross:       ${manifest.totalGrossAmount} units`);
    console.log(`Roster Commitment: ${manifest.rosterCommitment}`);
    if (options.output) {
      console.log(`Output File:       ${options.output}`);
    }
    console.log("-------------------------------------------------------");
    console.log(`✔ Encrypted payroll batch manifest created successfully.\n`);
  }

  return manifest;
}

export function registerCreateCommand(program: Command): void {
  program
    .command("create")
    .description("Parse roster CSV, encrypt amounts, compute commitment & batchId, output signed manifest")
    .requiredOption("-r, --roster <path>", "Path to employee roster CSV file or raw CSV string")
    .option("-t, --token <address>", "Confidential eERC token contract address", DEFAULT_CONTRACT_ADDRESSES.eercToken)
    .option("-o, --output <file>", "Output file path to save the generated JSON manifest")
    .option("-b, --batch-id <id>", "Optional explicit 32-byte hex batch ID")
    .option("-p, --payroll <address>", "PrivatePayroll coordinator contract address")
    .option("-a, --auditor <address>", "Compliance auditor EVM address")
    .option("-s, --silent", "Suppress console output")
    .action(async (opts) => {
      try {
        await createBatch(opts);
      } catch (err: any) {
        console.error(`\n❌ Batch creation failed: ${err.message || err}`);
        process.exitCode = 1;
      }
    });
}
