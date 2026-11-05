import assert from "node:assert";
import {
  evmAddressSchema,
  positiveAmountSchema,
  payrollItemSchema,
  payrollRosterItemsSchema,
  parsePayrollCsv,
  batchManifestSchema,
  complianceAttestationSchema,
  auditorReportSchema,
  MAX_SAFE_AMOUNT_51BIT,
  BatchStatus,
} from "../src/index.js";

console.log("==============================================================================");
console.log("   Running @cashlayer/shared Validation Unit Tests");
console.log("==============================================================================");

let passed = 0;
let failed = 0;

function it(name: string, fn: () => void) {
  try {
    fn();
    console.log(` ✔ ${name}`);
    passed++;
  } catch (err: any) {
    console.error(` ✘ ${name}`);
    console.error(err);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// EVM Address Validation Tests
// ---------------------------------------------------------------------------
it("validates valid 0x EVM address and normalizes to lowercase", () => {
  const input = "0x1111111111111111111111111111111111111111";
  const parsed = evmAddressSchema.parse(input);
  assert.strictEqual(parsed, "0x1111111111111111111111111111111111111111");

  const mixed = "0xAbCdEf1234567890aBcDeF1234567890AbCdEf12";
  const parsedMixed = evmAddressSchema.parse(mixed);
  assert.strictEqual(parsedMixed, mixed.toLowerCase());
});

it("rejects address without 0x prefix", () => {
  assert.throws(
    () => evmAddressSchema.parse("1111111111111111111111111111111111111111"),
    /Invalid recipient EVM address/
  );
});

it("rejects address with invalid length", () => {
  assert.throws(
    () => evmAddressSchema.parse("0x1234"),
    /Invalid recipient EVM address/
  );
  assert.throws(
    () => evmAddressSchema.parse("0x1111111111111111111111111111111111111111dead"),
    /Invalid recipient EVM address/
  );
});

it("rejects address with non-hex characters", () => {
  assert.throws(
    () => evmAddressSchema.parse("0xGGGG111111111111111111111111111111111111"),
    /Invalid recipient EVM address/
  );
});

// ---------------------------------------------------------------------------
// Positive Amount Validation Tests
// ---------------------------------------------------------------------------
it("validates positive bigint, number, and string amount representations", () => {
  assert.strictEqual(positiveAmountSchema.parse(5000n), 5000n);
  assert.strictEqual(positiveAmountSchema.parse(100), 100n);
  assert.strictEqual(positiveAmountSchema.parse("2500000"), 2500000n);
});

it("validates maximum safe 51-bit amount boundary (2^51 - 1)", () => {
  assert.strictEqual(positiveAmountSchema.parse(MAX_SAFE_AMOUNT_51BIT), MAX_SAFE_AMOUNT_51BIT);
  assert.strictEqual(positiveAmountSchema.parse(MAX_SAFE_AMOUNT_51BIT.toString()), MAX_SAFE_AMOUNT_51BIT);
});

it("rejects zero compensation amount", () => {
  assert.throws(() => positiveAmountSchema.parse(0), /strictly positive/);
  assert.throws(() => positiveAmountSchema.parse(0n), /strictly positive/);
  assert.throws(() => positiveAmountSchema.parse("0"), /strictly positive/);
});

it("rejects negative compensation amount", () => {
  assert.throws(() => positiveAmountSchema.parse(-50), /strictly positive/);
  assert.throws(() => positiveAmountSchema.parse(-100n), /strictly positive/);
  assert.throws(() => positiveAmountSchema.parse("-500"), /strictly positive/);
});

it("rejects non-numeric string or decimal amount", () => {
  assert.throws(() => positiveAmountSchema.parse("not_a_number"), /numeric/);
  assert.throws(() => positiveAmountSchema.parse("12.34"), /numeric/);
  assert.throws(() => positiveAmountSchema.parse(12.34), /integer/);
});

it("rejects amounts exceeding 51-bit range limit", () => {
  const overLimit = MAX_SAFE_AMOUNT_51BIT + 1n;
  assert.throws(() => positiveAmountSchema.parse(overLimit), /51-bit range limit/);
  assert.throws(() => positiveAmountSchema.parse(overLimit.toString()), /51-bit range limit/);
});

// ---------------------------------------------------------------------------
// Payroll Item & Roster Schemas
// ---------------------------------------------------------------------------
it("validates payroll item schema with valid recipient and positive amount", () => {
  const item = {
    recipient: "0x1111111111111111111111111111111111111111",
    amount: "75000",
    department: "Engineering",
  };
  const parsed = payrollItemSchema.parse(item);
  assert.strictEqual(parsed.recipient, item.recipient);
  assert.strictEqual(parsed.amount, 75000n);
  assert.strictEqual(parsed.department, "Engineering");
});

it("rejects roster with duplicate recipients", () => {
  const items = [
    { recipient: "0x1111111111111111111111111111111111111111", amount: "1000" },
    { recipient: "0x2222222222222222222222222222222222222222", amount: "2000" },
    { recipient: "0x1111111111111111111111111111111111111111", amount: "3000" },
  ];
  assert.throws(() => payrollRosterItemsSchema.parse(items), /Duplicate recipient address/);
});

// ---------------------------------------------------------------------------
// CSV Payroll Parser Tests
// ---------------------------------------------------------------------------
it("parses valid multi-row CSV payroll roster with header", () => {
  const csv = `address,amount,department
0x1111111111111111111111111111111111111111,150000,Engineering
0x2222222222222222222222222222222222222222,250000,Product`;

  const parsed = parsePayrollCsv(csv);
  assert.strictEqual(parsed.employeeCount, 2);
  assert.strictEqual(parsed.totalGrossAmount, 400000n);
  assert.strictEqual(parsed.recipients[0].amount, 150000n);
  assert.strictEqual(parsed.recipients[0].department, "Engineering");
  assert.strictEqual(parsed.recipients[1].amount, 250000n);
  assert.strictEqual(parsed.recipients[1].department, "Product");
});

it("rejects empty or whitespace-only CSV input", () => {
  assert.throws(() => parsePayrollCsv(""), /empty/);
  assert.throws(() => parsePayrollCsv("   \n\t  \r\n"), /empty/);
});

it("rejects header-only CSV without employee rows", () => {
  assert.throws(() => parsePayrollCsv("address,amount\n"), /No valid employee records/);
});

it("rejects CSV with malformed row (missing columns)", () => {
  assert.throws(
    () => parsePayrollCsv("address,amount\n0x1111111111111111111111111111111111111111"),
    /Malformed CSV row/
  );
});

it("rejects CSV with duplicate recipient addresses (exact and case-insensitive)", () => {
  const csvExact = `address,amount
0x1111111111111111111111111111111111111111,1000
0x1111111111111111111111111111111111111111,2000`;
  assert.throws(() => parsePayrollCsv(csvExact), /Duplicate recipient address/);

  const csvCase = `address,amount
0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA,500
0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa,800`;
  assert.throws(() => parsePayrollCsv(csvCase), /Duplicate recipient address/);
});

it("rejects CSV with non-numeric amount", () => {
  const csv = `address,amount\n0x1111111111111111111111111111111111111111,bad_amount`;
  assert.throws(() => parsePayrollCsv(csv), /Malformed CSV row/);
});

it("rejects CSV with negative or zero amount", () => {
  const csvZero = `address,amount\n0x1111111111111111111111111111111111111111,0`;
  assert.throws(() => parsePayrollCsv(csvZero), /strictly positive/);

  const csvNeg = `address,amount\n0x1111111111111111111111111111111111111111,-500`;
  assert.throws(() => parsePayrollCsv(csvNeg), /strictly positive/);
});

// ---------------------------------------------------------------------------
// Batch Manifest & Compliance Schemas
// ---------------------------------------------------------------------------
it("validates valid BatchManifest structure", () => {
  const manifest = {
    batchId: "0x0000000000000000000000000000000000000000000000000000000000000001",
    tokenAddress: "0xcccccccccccccccccccccccccccccccccccccccc",
    employeeCount: 1,
    totalGrossAmount: "50000",
    rosterCommitment: "0x1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff",
    recipients: [
      {
        address: "0x1111111111111111111111111111111111111111",
        amount: "50000",
      },
    ],
  };
  const parsed = batchManifestSchema.parse(manifest);
  assert.strictEqual(parsed.employeeCount, 1);
  assert.strictEqual(parsed.recipients.length, 1);
});

it("validates valid ComplianceAttestation and AuditorReport", () => {
  const attestation = {
    batchId: "0x0000000000000000000000000000000000000000000000000000000000000001",
    auditor: "0x3333333333333333333333333333333333333333",
    reportHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    verifiedAt: 1700000000n,
    isCompliant: true,
  };
  const parsedAtt = complianceAttestationSchema.parse(attestation);
  assert.strictEqual(parsedAtt.isCompliant, true);

  const report = {
    batchId: "0x0000000000000000000000000000000000000000000000000000000000000001",
    auditorAddress: "0x3333333333333333333333333333333333333333",
    totalDisbursed: 100000n,
    employeeCount: 2,
    isCompliant: true,
    discrepancies: [],
    reportHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    timestamp: 1700000000,
  };
  const parsedRep = auditorReportSchema.parse(report);
  assert.strictEqual(parsedRep.totalDisbursed, 100000n);
});

console.log("------------------------------------------------------------------------------");
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log("✔ ALL VALIDATION TESTS PASSED");
}
