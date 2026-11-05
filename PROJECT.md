# Project: CashLayer Private Payroll on Avalanche L1

## Architecture Overview
CashLayer Private Payroll is an application-layer confidential financial system built on Avalanche L1 utilizing the audited Avalanche eERC (Encrypted ERC) standard and SDK (`@avalabs/eerc-sdk`).

The system enables organizations to execute compensation payments with encrypted amounts and confidential balances while guaranteeing verifiable on-chain execution and controlled compliance access for authorized auditors.

### Monorepo Layered Architecture
```text
d:\Avalanche\
├── contracts/                     # Foundry smart contract suite
│   ├── src/
│   │   ├── PrivatePayroll.sol     # Payroll coordinator & batch lifecycle manager (Zero plaintext leakage)
│   │   ├── ComplianceVerifier.sol # Auditor registry & on-chain compliance attestation module
│   │   ├── interfaces/            # IEncryptedERC, IRegistrar, IPrivatePayroll, IComplianceVerifier
│   │   └── mock/                  # MockEncryptedERC & MockRegistrar for high-speed deterministic tests
│   ├── test/                      # Foundry unit, fuzz, invariant, and replay protection tests
│   └── script/Deploy.s.sol        # Avalanche L1 / Fuji / Anvil deployment scripts
├── packages/
│   ├── shared/                    # Shared TypeScript domain models, schemas, and constants
│   ├── eerc-adapter/              # ADR-0003 eERC SDK wrapper (Live mode + deterministic simulation)
│   └── cli/                       # Terminal CLI for automated payroll creation and audit verification
├── apps/
│   └── web/                       # Modern Web UI (React + Vite + Tailwind + Viem/Wagmi)
│       └── src/views/             # Employer, Employee, Auditor, and Public Observer views
└── scripts/
    └── e2e-runner.ts              # Opaque-box E2E test runner covering Tiers 1-4 & 5 personas
```

---

## Code Layout & File Boundaries
| Component | Directory Path | Primary Files | Write Ownership |
|---|---|---|---|
| **Root Config** | `d:\Avalanche\` | `package.json`, `.env.example`, `tsconfig.base.json` | Project Orchestrator / Foundation Worker |
| **Contracts** | `d:\Avalanche\contracts\` | `foundry.toml`, `src/**/*.sol`, `test/**/*.sol` | Milestone 1 (Contracts Worker) |
| **Shared Lib** | `d:\Avalanche\packages\shared\` | `package.json`, `src/types.ts`, `src/validation.ts` | Milestone 2 (Adapter/Shared Worker) |
| **eERC Adapter** | `d:\Avalanche\packages\eerc-adapter\` | `package.json`, `src/index.ts`, `src/crypto.ts`, `src/liveAdapter.ts` | Milestone 2 (Adapter/Shared Worker) |
| **CLI Tooling** | `d:\Avalanche\packages\cli\` | `package.json`, `src/index.ts`, `bin/payroll-cli.js` | Milestone 3 (CLI Worker) |
| **Web Frontend** | `d:\Avalanche\apps\web\` | `package.json`, `src/App.tsx`, `src/views/*` | Milestone 4 (Frontend Worker) |
| **E2E Test Suite** | `d:\Avalanche\tests\e2e\` | `test-runner.ts`, `tier1-feature.test.ts`, `tier2-boundary.test.ts`, `tier3-pairwise.test.ts`, `tier4-realworld.test.ts` | E2E Testing Track |

---

## Feature Inventory
Every capability identified across user requirements and documentation is catalogued below with its assigned milestone.

| # | Feature | Description | Milestone | Source |
|---|---|---|---|---|
| F01 | Monorepo & Toolchain Setup | Workspace configuration, package.json, Foundry config, env templates | M1 | Workspace Survey |
| F02 | Private Payroll Smart Contract | Batch coordinator, lifecycle states, idempotency & replay protection | M1 | PRD §5.1, SMART_CONTRACT_SPEC |
| F03 | Compliance Verifier Contract | Auditor registry, authorized compliance attestations | M1 | PRIVACY_AUDIT_SPEC |
| F04 | Contract Unit & Fuzz Tests | Invariant, replay, authorization, and zero-plaintext leakage tests | M1 | CONTRACT_TESTS.md |
| F05 | Shared Types & Zod Schemas | Domain entities, batch schemas, validation rules | M2 | PROJECT_STRUCTURE |
| F06 | BabyJub & Poseidon Cryptography | Twisted Edwards BN254 arithmetic, Poseidon sponge encryption | M2 | @avalabs/eerc-sdk |
| F07 | eERC Adapter (Live & Simulation) | Pinned SDK integration with offline fallback for deterministic testing | M2 | ADR-0003, EERC_INTEGRATION |
| F08 | Client Amount Encryption & Proofs | Client-side proof and ciphertext generation (`auditorPCT`) | M2 | EERC_INTEGRATION |
| F09 | Confidential Balance Decryption | Client-side BabyJub/Poseidon decryption without server access | M2 | SRS §3.2 |
| F10 | Auditor Decryption Module | Poseidon decryption of `uint256[7] auditorPCT` logs | M2 | PRIVACY_AUDIT_SPEC |
| F11 | CLI Batch Creator | Command to draft and validate encrypted payroll batches | M3 | TRD §6.2 |
| F12 | CLI Payroll Executor | Command to submit and verify confidential transfers on-chain | M3 | TRD §6.2 |
| F13 | CLI Compliance Auditor | Command to inspect on-chain logs and produce audit reports | M3 | PRIVACY_AUDIT_SPEC |
| F14 | Web Wallet Connection | Viem/Wagmi integration with Avalanche L1 network detection | M4 | WALLET_SPEC |
| F15 | Employer Batch Creation UI | Form input, CSV upload, recipient deduplication, pre-flight review | M4 | PRD §5.1 |
| F16 | Employee Confidential Portal | Private balance check, incoming transaction receipt decryption | M4 | PRD §5.2 |
| F17 | Auditor Compliance Panel | Verifiable compliance dashboard with strict non-overreach guardrails | M4 | PRIVACY_AUDIT_SPEC |
| F18 | Public Observer Explorer View | On-chain verification confirming zero plaintext leakage | M4 | PRD §5.4 |
| F19 | E2E Test Infrastructure | Multi-persona harness running headless transactions on Avalanche | E2E | TEST_INFRA |
| F20 | Tier 1 Feature Coverage Tests | ≥5 isolated tests per feature (F01 - F18) | E2E | Test Methodology |
| F21 | Tier 2 Boundary & Corner Tests | Edge cases, zero/negative, max batch size, duplicate recipients | E2E | Test Methodology |
| F22 | Tier 3 Pairwise Integration Tests | Cross-feature interactions (e.g. batch creation + audit verification) | E2E | Test Methodology |
| F23 | Tier 4 Real-World Workload Tests | Multi-employee corporate payroll runs and audit reconciliation | E2E | Test Methodology |
| F24 | Final Milestone Verification | 100% pass of Tiers 1-4 + Tier 5 adversarial coverage hardening | M5 | Final Milestone |

---

## Milestones Summary

### Implementation Track
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| M1 | Smart Contracts & Workspace Foundation | Monorepo config, `PrivatePayroll.sol`, `ComplianceVerifier.sol`, mocks, Foundry unit & fuzz tests | None | DONE (47 tests passed, 2x APPROVE) |
| M2 | eERC Adapter & Cryptographic Primitives | `packages/shared`, `packages/eerc-adapter` (BabyJub, Poseidon, auditorPCT, live & mock adapters) | M1 | DONE (93 unit tests passed, 2x APPROVE) |
| M3 | Command-Line Tooling (CLI) | `packages/cli` for headless batch creation, on-chain execution, and auditor compliance verification | M2 | DONE (28 CLI tests passed, 2x APPROVE) |
| M4 | Web Frontend Application | `apps/web` (React + Vite + Tailwind + Viem/Wagmi) with Employer, Employee, Auditor, and Observer views | M2 | IN_PROGRESS |
| M5 | Final Verification & Hardening | 100% E2E test pass (Tiers 1-4) + Tier 5 adversarial hardening | M3, M4, E2E | PLANNED |

### E2E Testing Track (Parallel)
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| E2E | Opaque-Box E2E Test Suite | Test runner harness, Tiers 1-4 test cases (≥150 tests), publish `TEST_READY.md` | M1 interface contracts | DONE (TEST_READY.md published, 176/176 tests passed) |

---

## Interface Contracts

### 1. Solidity Smart Contracts
- **`IPrivatePayroll.sol`**:
  - `createPayrollBatch(bytes32 batchId, address eercToken, uint32 employeeCount, bytes32 rosterCommitment)`
  - `confirmBatchExecution(bytes32 batchId, uint32 executedCount)`
  - `cancelBatch(bytes32 batchId, string reason)`
  - `getBatch(bytes32 batchId) view returns (PayrollBatch)`
  - `isBatchExecuted(bytes32 batchId) view returns (bool)`
- **`IComplianceVerifier.sol`**:
  - `registerAuditor(address auditor, string organizationName)`
  - `revokeAuditor(address auditor)`
  - `attestCompliance(bytes32 batchId, bytes32 reportHash, bool isCompliant)`
  - `isAuthorizedAuditor(address account) view returns (bool)`
- **`IEncryptedERC.sol`**:
  - `transfer(address to, uint256 tokenId, TransferProof proof, uint256[7] balancePCT, bytes message)`
  - `setAuditorPublicKey(address auditorAddress)`
  - `auditor() view returns (address)`
  - `auditorPublicKey() view returns (uint256[2])`

### 2. TypeScript eERC Adapter Interface (`packages/eerc-adapter/src/index.ts`)
```typescript
export interface IEERCAdapter {
  initialize(rpcUrl: string, tokenAddress: `0x${string}`, registrarAddress?: `0x${string}`): Promise<void>;
  registerAccount(privateKey: `0x${string}`): Promise<{ publicKey: [bigint, bigint]; txHash?: `0x${string}` }>;
  getEncryptedBalance(userAddress: `0x${string}`, viewingKey?: string): Promise<{ encrypted: [bigint, bigint, bigint, bigint]; decrypted?: bigint }>;
  preparePayrollTransfer(params: {
    senderPrivateKey: `0x${string}`;
    recipientAddress: `0x${string}`;
    amount: bigint;
    senderBalance: bigint;
    auditorAddress: `0x${string}`;
  }): Promise<{
    proof: TransferProof;
    balancePCT: string[];
    receiverEncryptedAmount: string[];
    auditorPCT: string[];
  }>;
  executeBatchTransfers(params: {
    batchId: `0x${string}`;
    transfers: Array<{ recipient: `0x${string}`; amount: bigint }>;
    senderPrivateKey: `0x${string}`;
  }): Promise<{ txHashes: `0x${string}`[]; receiptStatuses: number[] }>;
  auditorDecrypt(auditorPrivateKey: string, fromBlock?: bigint): Promise<Array<{
    txHash: `0x${string}`;
    amount: bigint;
    sender: `0x${string}`;
    recipient: `0x${string}`;
    blockNumber: bigint;
  }>>;
}
```

### 3. CLI Commands Specification
- `cashlayer-payroll batch create --roster <path-to-csv> --token <addr> --output <batch.json>`
- `cashlayer-payroll batch execute --batch <batch.json> --key <privkey> --rpc <url>`
- `cashlayer-payroll audit verify --batch-id <id> --auditor-key <key> --rpc <url>`
- `cashlayer-payroll employee balance --employee <addr> --viewing-key <key> --rpc <url>`
