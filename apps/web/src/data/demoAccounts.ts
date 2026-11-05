import { DemoAccount } from "../types";
import { BabyJub } from "@cashlayer/eerc-adapter";

// Deterministic BabyJub secrets for testing personas
const EMPLOYER_SK = 10000001n;
const EMP1_SK = 20000001n;
const EMP2_SK = 30000001n;
const EMP3_SK = 40000001n;
const EMP4_SK = 50000001n;
const EMP5_SK = 60000001n;
const AUDITOR_SK = 70000001n;
const OBSERVER_SK = 80000001n;

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    id: "employer",
    name: "Acme Corp (Employer)",
    role: "employer",
    address: "0x1111111111111111111111111111111111111111",
    evmPrivateKey: "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    babyJubSecret: EMPLOYER_SK,
    babyJubPublicKey: BabyJub.generatePublicKey(EMPLOYER_SK),
    description: "Corporate payroll operator with batch authorization & settlement rights",
  },
  {
    id: "employee1",
    name: "Alice (Staff Engineer)",
    role: "employee",
    address: "0x2222222222222222222222222222222222222222",
    evmPrivateKey: "0x1122334455667788990011223344556677889900112233445566778899001122",
    babyJubSecret: EMP1_SK,
    babyJubPublicKey: BabyJub.generatePublicKey(EMP1_SK),
    description: "Senior Engineering Staff — viewing key: 20000001",
  },
  {
    id: "employee2",
    name: "Bob (Product Manager)",
    role: "employee",
    address: "0x3333333333333333333333333333333333333333",
    evmPrivateKey: "0x2233445566778899001122334455667788990011223344556677889900112233",
    babyJubSecret: EMP2_SK,
    babyJubPublicKey: BabyJub.generatePublicKey(EMP2_SK),
    description: "Core Product Management — viewing key: 30000001",
  },
  {
    id: "employee3",
    name: "Charlie (UX Designer)",
    role: "employee",
    address: "0x4444444444444444444444444444444444444444",
    evmPrivateKey: "0x3344556677889900112233445566778899001122334455667788990011223344",
    babyJubSecret: EMP3_SK,
    babyJubPublicKey: BabyJub.generatePublicKey(EMP3_SK),
    description: "Design Systems Lead — viewing key: 40000001",
  },
  {
    id: "employee4",
    name: "Diana (QA Lead)",
    role: "employee",
    address: "0x5555555555555555555555555555555555555555",
    evmPrivateKey: "0x4455667788990011223344556677889900112233445566778899001122334455",
    babyJubSecret: EMP4_SK,
    babyJubPublicKey: BabyJub.generatePublicKey(EMP4_SK),
    description: "Quality Assurance Lead — viewing key: 50000001",
  },
  {
    id: "employee5",
    name: "Evan (DevOps Specialist)",
    role: "employee",
    address: "0x6666666666666666666666666666666666666666",
    evmPrivateKey: "0x5566778899001122334455667788990011223344556677889900112233445566",
    babyJubSecret: EMP5_SK,
    babyJubPublicKey: BabyJub.generatePublicKey(EMP5_SK),
    description: "Infrastructure Engineering — viewing key: 60000001",
  },
  {
    id: "auditor",
    name: "Apex Compliance LLC (Auditor)",
    role: "auditor",
    address: "0x7777777777777777777777777777777777777777",
    evmPrivateKey: "0x6677889900112233445566778899001122334455667788990011223344556677",
    babyJubSecret: AUDITOR_SK,
    babyJubPublicKey: BabyJub.generatePublicKey(AUDITOR_SK),
    description: "Authorized regulatory auditor holding public key on eERC token",
  },
  {
    id: "observer",
    name: "Public Blockchain Observer",
    role: "observer",
    address: "0x8888888888888888888888888888888888888888",
    evmPrivateKey: "0x7788990011223344556677889900112233445566778899001122334455667788",
    babyJubSecret: OBSERVER_SK,
    babyJubPublicKey: BabyJub.generatePublicKey(OBSERVER_SK),
    description: "Public node inspector without cryptographic access keys",
  },
];
