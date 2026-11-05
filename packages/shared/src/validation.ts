/**
 * Validation Schemas & Parsers for CashLayer Private Payroll.
 * Uses Zod for runtime boundary checks and sanitization.
 */

import { z } from "zod";
import { MAX_SAFE_AMOUNT_51BIT } from "./constants.js";

// ===========================================================================
// EVM Address Validation
// ===========================================================================

export const EVM_ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;

export const evmAddressSchema = z
  .string()
  .trim()
  .refine((val) => EVM_ADDRESS_REGEX.test(val), {
    message: "Invalid recipient EVM address: must be 0x-prefixed 40 hexadecimal characters",
  })
  .transform((val) => val.toLowerCase() as `0x${string}`);

// ===========================================================================
// Compensation Amount Validation
// ===========================================================================

export const positiveAmountSchema = z.union([z.string(), z.number(), z.bigint()]).transform((val, ctx) => {
  let bi: bigint;
  try {
    if (typeof val === "bigint") {
      bi = val;
    } else if (typeof val === "number") {
      if (!Number.isInteger(val) || val < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Compensation amount must be strictly positive integer",
        });
        return z.NEVER;
      }
      bi = BigInt(val);
    } else {
      const trimmed = val.trim();
      if (!/^-?\d+$/.test(trimmed)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Malformed amount: must be numeric digits",
        });
        return z.NEVER;
      }
      bi = BigInt(trimmed);
    }
  } catch {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Failed to parse compensation amount as bigint",
    });
    return z.NEVER;
  }

  if (bi <= 0n) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Compensation amount must be strictly positive",
    });
    return z.NEVER;
  }

  if (bi > MAX_SAFE_AMOUNT_51BIT) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Compensation amount exceeds 51-bit range limit (${MAX_SAFE_AMOUNT_51BIT.toString()})`,
    });
    return z.NEVER;
  }

  return bi;
});

// ===========================================================================
// Payroll Item & Roster Schemas
// ===========================================================================

export const payrollItemSchema = z.object({
  recipient: evmAddressSchema,
  amount: positiveAmountSchema,
  department: z.string().optional(),
  notes: z.string().optional(),
});

export const payrollRosterItemsSchema = z
  .array(payrollItemSchema)
  .min(1, "Payroll roster must contain at least one recipient")
  .refine(
    (items) => {
      const seen = new Set<string>();
      for (const item of items) {
        const lower = item.recipient.toLowerCase();
        if (seen.has(lower)) return false;
        seen.add(lower);
      }
      return true;
    },
    { message: "Duplicate recipient address detected in roster" }
  );

// ===========================================================================
// CSV Roster Parser & Validator
// ===========================================================================

export interface ParsedPayrollCsv {
  recipients: Array<{
    recipient: `0x${string}`;
    amount: bigint;
    department?: string;
  }>;
  employeeCount: number;
  totalGrossAmount: bigint;
  uniqueAddresses: `0x${string}`[];
}

/**
 * Parses and strictly validates CSV string containing payroll entries.
 * Format expected:
 *   address,amount[,department]
 *
 * Enforces:
 * - Non-empty content
 * - Valid header
 * - At least one valid employee row
 * - 0x-prefixed 40 hex character addresses
 * - Strictly positive numeric amounts <= 2^51 - 1
 * - Case-insensitive address deduplication
 */
export function parsePayrollCsv(csvContent: string): ParsedPayrollCsv {
  if (!csvContent || csvContent.trim().length === 0) {
    throw new Error("CLI Error: Roster CSV is empty");
  }

  const lines = csvContent
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    throw new Error("CLI Error: Roster CSV is empty");
  }

  const recipients: Array<{
    recipient: `0x${string}`;
    amount: bigint;
    department?: string;
  }> = [];
  const seen = new Set<string>();
  let totalGross = 0n;
  let parsedRowCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Check header on line 0
    if (i === 0 && line.toLowerCase().includes("address")) {
      continue;
    }

    const parts = line.split(",").map((s) => s.trim());
    if (parts.length < 2 || !parts[0] || !parts[1]) {
      throw new Error(`CLI Error: Malformed CSV row at index ${i}: "${line}"`);
    }

    const [addrRaw, amountRaw, department] = parts;

    // EVM address format check
    if (!addrRaw.toLowerCase().startsWith("0x") || addrRaw.length !== 42 || !EVM_ADDRESS_REGEX.test(addrRaw)) {
      throw new Error(`CLI Error: Invalid recipient EVM address: ${addrRaw}`);
    }

    const addrLower = addrRaw.toLowerCase() as `0x${string}`;
    if (seen.has(addrLower)) {
      throw new Error(`CLI Error: Duplicate recipient address detected: ${addrRaw}`);
    }
    seen.add(addrLower);

    // Amount check
    let amount: bigint;
    try {
      if (!/^-?\d+$/.test(amountRaw)) {
        throw new Error("not digits");
      }
      amount = BigInt(amountRaw);
    } catch {
      throw new Error(`CLI Error: Malformed CSV row at index ${i}: Invalid numeric amount "${amountRaw}"`);
    }

    if (amount <= 0n) {
      throw new Error(`CLI Error: Amount must be strictly positive: ${amountRaw}`);
    }

    if (amount > MAX_SAFE_AMOUNT_51BIT) {
      throw new Error(`CLI Error: Amount exceeds 51-bit range limit (${MAX_SAFE_AMOUNT_51BIT}): ${amountRaw}`);
    }

    totalGross += amount;
    recipients.push({
      recipient: addrLower,
      amount,
      department: department || undefined,
    });
    parsedRowCount++;
  }

  if (parsedRowCount === 0) {
    throw new Error("CLI Error: No valid employee records parsed from CSV");
  }

  return {
    recipients,
    employeeCount: recipients.length,
    totalGrossAmount: totalGross,
    uniqueAddresses: Array.from(seen) as `0x${string}`[],
  };
}

// ===========================================================================
// Batch Manifest & Compliance Schemas
// ===========================================================================

export const batchManifestSchema = z.object({
  batchId: z.string().regex(/^0x[0-9a-fA-F]{64}$/, "batchId must be bytes32 hex string"),
  tokenAddress: evmAddressSchema,
  employeeCount: z.number().int().positive("Employee count must be > 0"),
  totalGrossAmount: z.string().regex(/^\d+$/, "totalGrossAmount must be numeric string"),
  rosterCommitment: z.string().regex(/^0x[0-9a-fA-F]{64}$/, "rosterCommitment must be bytes32 hex string"),
  recipients: z.array(
    z.object({
      address: evmAddressSchema,
      amount: z.string().regex(/^\d+$/, "amount must be numeric string"),
      department: z.string().optional(),
    })
  ).min(1, "Recipients list cannot be empty"),
  createdAt: z.string().optional(),
});

export const complianceAttestationSchema = z.object({
  batchId: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  auditor: evmAddressSchema,
  reportHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  verifiedAt: z.bigint().nonnegative(),
  isCompliant: z.boolean(),
});

export const auditorReportSchema = z.object({
  batchId: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  auditorAddress: evmAddressSchema,
  totalDisbursed: z.bigint().nonnegative(),
  employeeCount: z.number().int().nonnegative(),
  isCompliant: z.boolean(),
  discrepancies: z.array(z.string()),
  reportHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  timestamp: z.number().int().positive(),
});
