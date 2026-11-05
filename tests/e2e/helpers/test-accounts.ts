/**
 * Predefined deterministic test accounts and roles for CashLayer Private Payroll E2E.
 * Provides EVM addresses, private keys, BabyJubjub keys, and persona descriptions.
 */

import { BabyJub, Point } from "./crypto-sim.ts";

export interface TestAccount {
  name: string;
  role: "employer" | "employee" | "auditor" | "observer" | "attacker";
  address: `0x${string}`;
  evmPrivateKey: `0x${string}`;
  babyJubSecret: bigint;
  babyJubPublicKey: Point;
  defaultSalary?: bigint;
}

// Deterministic BabyJub secrets for testing
const EMPLOYER_SK = 10000001n;
const EMP1_SK = 20000001n;
const EMP2_SK = 30000001n;
const EMP3_SK = 40000001n;
const EMP4_SK = 50000001n;
const EMP5_SK = 60000001n;
const AUDITOR_SK = 70000001n;
const OBSERVER_SK = 80000001n;
const ATTACKER_SK = 90000001n;

export const TEST_ACCOUNTS: Record<string, TestAccount> = {
  employer: {
    name: "Acme Corp (Employer)",
    role: "employer",
    address: "0x1111111111111111111111111111111111111111",
    evmPrivateKey: "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    babyJubSecret: EMPLOYER_SK,
    babyJubPublicKey: BabyJub.generatePublicKey(EMPLOYER_SK),
  },
  employee1: {
    name: "Alice (Staff Engineer)",
    role: "employee",
    address: "0x2222222222222222222222222222222222222222",
    evmPrivateKey: "0x1122334455667788990011223344556677889900112233445566778899001122",
    babyJubSecret: EMP1_SK,
    babyJubPublicKey: BabyJub.generatePublicKey(EMP1_SK),
    defaultSalary: 1250000n, // e.g. 12,500 units
  },
  employee2: {
    name: "Bob (Product Manager)",
    role: "employee",
    address: "0x3333333333333333333333333333333333333333",
    evmPrivateKey: "0x2233445566778899001122334455667788990011223344556677889900112233",
    babyJubSecret: EMP2_SK,
    babyJubPublicKey: BabyJub.generatePublicKey(EMP2_SK),
    defaultSalary: 1100000n,
  },
  employee3: {
    name: "Charlie (UX Designer)",
    role: "employee",
    address: "0x4444444444444444444444444444444444444444",
    evmPrivateKey: "0x3344556677889900112233445566778899001122334455667788990011223344",
    babyJubSecret: EMP3_SK,
    babyJubPublicKey: BabyJub.generatePublicKey(EMP3_SK),
    defaultSalary: 950000n,
  },
  employee4: {
    name: "Diana (QA Lead)",
    role: "employee",
    address: "0x5555555555555555555555555555555555555555",
    evmPrivateKey: "0x4455667788990011223344556677889900112233445566778899001122334455",
    babyJubSecret: EMP4_SK,
    babyJubPublicKey: BabyJub.generatePublicKey(EMP4_SK),
    defaultSalary: 980000n,
  },
  employee5: {
    name: "Evan (DevOps Specialist)",
    role: "employee",
    address: "0x6666666666666666666666666666666666666666",
    evmPrivateKey: "0x5566778899001122334455667788990011223344556677889900112233445566",
    babyJubSecret: EMP5_SK,
    babyJubPublicKey: BabyJub.generatePublicKey(EMP5_SK),
    defaultSalary: 1050000n,
  },
  auditor: {
    name: "Apex Compliance LLC (Auditor)",
    role: "auditor",
    address: "0x7777777777777777777777777777777777777777",
    evmPrivateKey: "0x6677889900112233445566778899001122334455667788990011223344556677",
    babyJubSecret: AUDITOR_SK,
    babyJubPublicKey: BabyJub.generatePublicKey(AUDITOR_SK),
  },
  observer: {
    name: "Public Blockchain Observer",
    role: "observer",
    address: "0x8888888888888888888888888888888888888888",
    evmPrivateKey: "0x7788990011223344556677889900112233445566778899001122334455667788",
    babyJubSecret: OBSERVER_SK,
    babyJubPublicKey: BabyJub.generatePublicKey(OBSERVER_SK),
  },
  attacker: {
    name: "Mallory (Unauthorized Attacker)",
    role: "attacker",
    address: "0x9999999999999999999999999999999999999999",
    evmPrivateKey: "0x8899001122334455667788990011223344556677889900112233445566778899",
    babyJubSecret: ATTACKER_SK,
    babyJubPublicKey: BabyJub.generatePublicKey(ATTACKER_SK),
  },
};
