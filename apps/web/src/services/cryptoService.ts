import {
  parsePayrollCsv,
  MAX_SAFE_AMOUNT_51BIT,
  EVM_ADDRESS_REGEX,
  AuditorPCT,
  DecryptedTransaction,
} from "@cashlayer/shared";
import { BabyJub, Poseidon } from "@cashlayer/eerc-adapter";
import { WebPayrollItem, WebBatchPreflightSummary, OnChainTxLog } from "../types";

export class CryptoService {
  /**
   * Computes a deterministic 32-byte cryptographic commitment for a payroll roster
   * using Poseidon sponge hashing over addresses and amounts.
   */
  static computeRosterCommitment(
    items: Array<{ address: string; amount: bigint }>
  ): `0x${string}` {
    if (items.length === 0) {
      return "0x0000000000000000000000000000000000000000000000000000000000000000";
    }

    const scalars: bigint[] = [];
    for (const item of items) {
      scalars.push(BigInt(item.address));
      scalars.push(item.amount);
    }

    const hash = Poseidon.hash(scalars);
    return `0x${hash.toString(16).padStart(64, "0")}` as `0x${string}`;
  }

  /**
   * Pre-flight batch validator and summary calculator.
   * Performs deduplication, EVM address validation, and 51-bit range checks.
   */
  static validateAndSummarizeBatch(items: WebPayrollItem[]): {
    valid: boolean;
    errors: string[];
    summary?: WebBatchPreflightSummary;
    sanitizedItems?: Array<{ address: `0x${string}`; amount: bigint; department?: string }>;
  } {
    const errors: string[] = [];
    const seen = new Set<string>();
    let totalGross = 0n;

    if (!items || items.length === 0) {
      return { valid: false, errors: ["Payroll batch cannot be empty. Add at least one recipient."] };
    }

    const sanitized: Array<{ address: `0x${string}`; amount: bigint; department?: string }> = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const rowNum = i + 1;
      const addrRaw = item.address.trim();

      if (!addrRaw.startsWith("0x") || addrRaw.length !== 42 || !EVM_ADDRESS_REGEX.test(addrRaw)) {
        errors.push(`Row ${rowNum}: Invalid EVM address "${item.address}". Must be 0x-prefixed 40 hex characters.`);
        continue;
      }

      const lowerAddr = addrRaw.toLowerCase() as `0x${string}`;
      if (seen.has(lowerAddr)) {
        errors.push(`Row ${rowNum}: Duplicate recipient address "${item.address}". Recipients must be unique.`);
        continue;
      }
      seen.add(lowerAddr);

      let amtBig: bigint;
      try {
        const amtStr = item.amount.trim();
        if (!/^\d+$/.test(amtStr)) {
          errors.push(`Row ${rowNum}: Malformed amount "${item.amount}". Must be numeric integer.`);
          continue;
        }
        amtBig = BigInt(amtStr);
      } catch {
        errors.push(`Row ${rowNum}: Failed to parse amount "${item.amount}".`);
        continue;
      }

      if (amtBig <= 0n) {
        errors.push(`Row ${rowNum}: Amount must be strictly positive (> 0).`);
        continue;
      }

      if (amtBig > MAX_SAFE_AMOUNT_51BIT) {
        errors.push(`Row ${rowNum}: Amount exceeds 51-bit circom range limit (${MAX_SAFE_AMOUNT_51BIT.toString()}).`);
        continue;
      }

      totalGross += amtBig;
      sanitized.push({
        address: lowerAddr,
        amount: amtBig,
        department: item.department?.trim() || undefined,
      });
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    const commitment = this.computeRosterCommitment(sanitized);

    return {
      valid: true,
      errors: [],
      sanitizedItems: sanitized,
      summary: {
        employeeCount: sanitized.length,
        totalPlaintextGross: totalGross,
        deduplicatedCount: seen.size,
        estimatedGas: BigInt(sanitized.length) * 420000n + 150000n,
        rosterCommitment: commitment,
        zeroPlaintextShieldValid: true,
      },
    };
  }

  /**
   * Parses CSV string into WebPayrollItem list with schema checking.
   */
  static parseRosterCsvString(csv: string): { items: WebPayrollItem[]; errors?: string[] } {
    try {
      const parsed = parsePayrollCsv(csv);
      const items: WebPayrollItem[] = parsed.recipients.map((r, idx) => ({
        id: `csv-${idx}-${Date.now()}`,
        address: r.recipient,
        amount: r.amount.toString(),
        department: r.department,
      }));
      return { items };
    } catch (err: any) {
      return { items: [], errors: [err?.message || "Failed to parse CSV"] };
    }
  }

  /**
   * Decrypts an incoming payment or confidential balance using a BabyJub secret viewing key.
   */
  static decryptCiphertext(viewingKey: string | bigint, cipherText: string[]): bigint {
    let sk: bigint;
    try {
      sk = typeof viewingKey === "bigint" ? viewingKey : BigInt(viewingKey.trim());
    } catch {
      throw new Error("Invalid viewing key: must be numeric BigInt");
    }

    if (cipherText.length !== 7) {
      throw new Error(`Invalid ciphertext layout: expected 7 fields, got ${cipherText.length}`);
    }

    return Poseidon.decryptAuditorPCT(sk, cipherText);
  }

  /**
   * Confirms that calldata and transaction logs do not contain raw sensitive plaintext numbers.
   */
  static verifyZeroPlaintextLeakage(
    txLog: OnChainTxLog,
    sensitiveAmounts: bigint[]
  ): { isSecure: boolean; leakedAmounts: bigint[] } {
    const leaked: bigint[] = [];

    const dataToCheck = [
      txLog.calldataPreview.toLowerCase(),
      ...txLog.auditorPCT.map((p) => p.toLowerCase()),
      ...txLog.receiverEncryptedAmount.map((r) => r.toLowerCase()),
    ].join(" ");

    for (const amt of sensitiveAmounts) {
      const amtStr = amt.toString();
      const amtHexNoPrefix = amt.toString(16).toLowerCase();
      const amtHex32 = amtHexNoPrefix.padStart(64, "0");

      if (dataToCheck.includes(amtStr) || dataToCheck.includes(amtHex32)) {
        leaked.push(amt);
      }
    }

    return {
      isSecure: leaked.length === 0,
      leakedAmounts: leaked,
    };
  }
}
