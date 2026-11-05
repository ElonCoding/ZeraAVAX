/**
 * Command: audit verify
 * Discovers and decrypts on-chain PrivateTransfer logs, reconciles disbursements against expected batch totals,
 * calculates cryptographic compliance reportHash, outputs audit report JSON, and optionally attests on-chain.
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
  AuditorReport,
  ComplianceAttestation,
  evmAddressSchema,
} from "@cashlayer/shared";
import { ComplianceAuditor } from "@cashlayer/eerc-adapter";
import {
  DEFAULT_CONTRACT_ADDRESSES,
  COMPLIANCE_VERIFIER_ABI,
} from "../contracts.js";
import {
  isMockRpc,
  getSimulatedState,
  resolveAdapter,
} from "../adapters.js";

export interface AuditVerifyOptions {
  batchId: string;
  auditorKey: string;
  rpc?: string;
  auditorAddress?: string;
  expectedTotal?: string;
  fromBlock?: string;
  token?: string;
  verifier?: string;
  attest?: boolean;
  attestKey?: string;
  output?: string;
  mock?: boolean;
  silent?: boolean;
}

export async function verifyAudit(options: AuditVerifyOptions): Promise<AuditorReport & { attestationTxHash?: string }> {
  if (!options.batchId) {
    throw new Error("CLI Error: Batch ID is required (--batch-id)");
  }
  if (!options.auditorKey) {
    throw new Error("CLI Error: Auditor BabyJubjub private key is required (--auditor-key)");
  }

  // 1. Format Batch ID
  const rawBatch = options.batchId.trim();
  const hexBatch = (rawBatch.startsWith("0x") ? rawBatch : `0x${rawBatch}`) as `0x${string}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(hexBatch)) {
    throw new Error("CLI Error: Invalid batch-id format: must be 32-byte hex string (0x...)");
  }

  // 2. Parse Auditor Key
  let keyStr = options.auditorKey.trim();
  if (keyStr.startsWith("0x")) {
    try {
      keyStr = BigInt(keyStr).toString();
    } catch {
      throw new Error("CLI Error: Malformed auditor private key");
    }
  }

  // 3. Auditor EVM Address
  let auditorAddress: `0x${string}`;
  if (options.auditorAddress) {
    auditorAddress = evmAddressSchema.parse(options.auditorAddress);
  } else if (options.attestKey) {
    const acc = privateKeyToAccount(options.attestKey as `0x${string}`);
    auditorAddress = acc.address.toLowerCase() as `0x${string}`;
  } else {
    auditorAddress = DEFAULT_CONTRACT_ADDRESSES.auditor;
  }

  const verifierAddress = options.verifier
    ? evmAddressSchema.parse(options.verifier)
    : DEFAULT_CONTRACT_ADDRESSES.complianceVerifier;
  const tokenAddress = options.token
    ? evmAddressSchema.parse(options.token)
    : DEFAULT_CONTRACT_ADDRESSES.eercToken;

  const mockMode = isMockRpc(options.rpc, options.mock);
  const fromBlock = options.fromBlock ? BigInt(options.fromBlock) : undefined;

  let report: AuditorReport;
  let attestationTxHash: string | undefined;

  if (mockMode) {
    const sim = getSimulatedState();
    sim.mockAdapter.tokenAddress = tokenAddress;

    const auditor = new ComplianceAuditor(sim.mockAdapter, verifierAddress);
    const decryptedTxs = await auditor.fetchDecryptedTransactions(keyStr, fromBlock);

    let totalDisbursed = 0n;
    for (const tx of decryptedTxs) {
      totalDisbursed += tx.amount;
    }

    const discrepancies: string[] = [];
    if (options.expectedTotal !== undefined) {
      const expTotal = BigInt(options.expectedTotal);
      if (totalDisbursed !== expTotal) {
        discrepancies.push(
          `Discrepancy detected: Decrypted sum (${totalDisbursed.toString()}) does not match expected batch total (${expTotal.toString()})`
        );
      }
    }

    const isCompliant = discrepancies.length === 0 && (decryptedTxs.length > 0 || options.expectedTotal === "0");
    const reportHash = ComplianceAuditor.computeReportHash(hexBatch, totalDisbursed, isCompliant);

    report = {
      batchId: hexBatch,
      auditorAddress,
      totalDisbursed,
      employeeCount: decryptedTxs.length,
      isCompliant,
      discrepancies,
      reportHash,
      timestamp: Math.floor(Date.now() / 1000),
      transactions: decryptedTxs,
    };

    if (options.attest) {
      const attestation: ComplianceAttestation = {
        batchId: hexBatch,
        auditor: auditorAddress,
        reportHash,
        verifiedAt: BigInt(Date.now()),
        isCompliant,
      };
      sim.attestations.set(`${hexBatch.toLowerCase()}-${auditorAddress.toLowerCase()}`, attestation);
      attestationTxHash = `0xattest-${hexBatch.slice(2, 10)}${Date.now().toString(16)}`;
    }
  } else {
    // Live RPC Mode
    const adapter = await resolveAdapter({
      rpc: options.rpc,
      token: tokenAddress,
    });
    const auditor = new ComplianceAuditor(adapter, verifierAddress);

    let expTotal: bigint | undefined = undefined;
    if (options.expectedTotal !== undefined) {
      expTotal = BigInt(options.expectedTotal);
    }

    report = await auditor.reconcileBatch({
      batchId: hexBatch,
      expectedTotal: expTotal ?? 0n,
      auditorPrivateKey: keyStr,
      auditorAddress,
      fromBlock,
    });

    if (options.attest && options.attestKey) {
      const account = privateKeyToAccount(options.attestKey as `0x${string}`);
      const publicClient = createPublicClient({
        transport: http(options.rpc),
      }) as unknown as PublicClient;
      const walletClient = createWalletClient({
        account,
        transport: http(options.rpc),
      });

      const txHash = await walletClient.writeContract({
        chain: null,
        address: verifierAddress,
        abi: COMPLIANCE_VERIFIER_ABI,
        functionName: "attestCompliance",
        args: [hexBatch, report.reportHash, report.isCompliant],
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      attestationTxHash = txHash;
    }
  }

  // Format final report for output
  const finalReport = {
    ...report,
    totalDisbursedString: report.totalDisbursed.toString(),
    attestationTxHash,
  };

  // Save to file if specified
  if (options.output) {
    const resolvedPath = path.resolve(process.cwd(), options.output);
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const serializable = {
      ...finalReport,
      totalDisbursed: report.totalDisbursed.toString(),
      transactions: report.transactions?.map((t) => ({
        ...t,
        amount: t.amount.toString(),
        blockNumber: Number(t.blockNumber),
      })),
    };
    fs.writeFileSync(resolvedPath, JSON.stringify(serializable, null, 2), "utf-8");
  }

  // Console output
  if (!options.silent) {
    console.log("\n=======================================================");
    console.log("   CashLayer Private Payroll — Compliance Audit Report");
    console.log("=======================================================");
    console.log(`Batch ID:          ${report.batchId}`);
    console.log(`Auditor Address:   ${report.auditorAddress}`);
    console.log(`Total Disbursed:   ${report.totalDisbursed.toString()} units`);
    console.log(`Disbursements:     ${report.employeeCount} transfers audited`);
    console.log(`Compliance Status: ${report.isCompliant ? "✔ COMPLIANT" : "❌ NON-COMPLIANT"}`);
    console.log(`Report Hash:       ${report.reportHash}`);
    if (attestationTxHash) {
      console.log(`Attestation Tx:    ${attestationTxHash} (Submitted On-Chain)`);
    }
    if (report.discrepancies.length > 0) {
      console.log(`Discrepancies:`);
      for (const disc of report.discrepancies) {
        console.log(`  - ${disc}`);
      }
    }
    if (options.output) {
      console.log(`Report File:       ${options.output}`);
    }
    console.log("-------------------------------------------------------");
    console.log(
      report.isCompliant
        ? `✔ Audit verified zero discrepancy; payroll is fully compliant.\n`
        : `⚠ Audit reconciliation detected discrepancies.\n`
    );
  }

  return finalReport;
}

export function registerAuditCommand(program: Command): void {
  program
    .command("verify")
    .description("Decrypt auditorPCT logs, reconcile total disbursements, and generate compliance report")
    .requiredOption("-b, --batch-id <id>", "Batch ID (32-byte hex string)")
    .requiredOption("-k, --auditor-key <key>", "Auditor BabyJubjub private key (scalar or hex)")
    .option("--rpc <url>", "Avalanche RPC URL or 'mock'", "mock")
    .option("-a, --auditor-address <address>", "Auditor EVM wallet address")
    .option("-e, --expected-total <amount>", "Expected total gross batch disbursements")
    .option("-f, --from-block <number>", "Starting block number for scanning logs")
    .option("-t, --token <address>", "Confidential token contract address")
    .option("-v, --verifier <address>", "ComplianceVerifier contract address")
    .option("--attest", "Post immutable compliance attestation to ComplianceVerifier contract")
    .option("--attest-key <key>", "Auditor EVM private key for on-chain attestation transaction")
    .option("-o, --output <file>", "Output file path to save audit report JSON")
    .option("-m, --mock", "Force offline simulation mode")
    .option("-s, --silent", "Suppress console output")
    .action(async (opts) => {
      try {
        await verifyAudit(opts);
      } catch (err: any) {
        console.error(`\n❌ Audit verification failed: ${err.message || err}`);
        process.exitCode = 1;
      }
    });
}
