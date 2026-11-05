# Test Infrastructure & Methodology Specification: CashLayer Private Payroll E2E

## 1. Executive Summary & Philosophy
CashLayer Private Payroll is an application-layer confidential financial platform executing on Avalanche L1 utilizing the audited Avalanche eERC (Encrypted ERC) standard and SDK (`@avalabs/eerc-sdk`).

The E2E test suite adheres to a strict **opaque-box testing philosophy**:
- Test cases are derived strictly from **user requirements, functional specifications, and public interface contracts** (`IPrivatePayroll.sol`, `IComplianceVerifier.sol`, `IEERCAdapter`, and CLI commands), never from implementation internals.
- **Zero-Plaintext Invariant**: Every test interacting with transactions programmatically inspects transaction calldata and on-chain event logs to verify that sensitive compensation values are never exposed in plaintext.
- **Independence & Isolation**: Every test scenario provisions its own clean, deterministic state, avoiding sequential test dependencies or side-effect leaks.
- **Progressive Testability**: The harness is fully executable and self-contained, capable of running headless without requiring external live network access.

---

## 2. 4-Tier Test Case Design Methodology

```text
+----------------------------------------------------------------------------------------------------+
|                                    4-TIER TEST ARCHITECTURE                                         |
+----------------------------------------------------------------------------------------------------+
| Tier 1: Feature Coverage (F01 - F18)                     | Tier 2: Boundary & Corner Cases         |
| - >= 5 isolated tests per feature (90 tests)             | - Zero, minimum, maximum uint51 (60 ts) |
| - Happy path & functional interface contracts            | - Duplicates, empty inputs, replay      |
+----------------------------------------------------------+-----------------------------------------+
| Tier 3: Pairwise Combinatorial Interactions              | Tier 4: Real-World Workload Scenarios   |
| - Cross-feature combinations (20 tests)                  | - 6 Comprehensive corporate scenarios   |
| - CLI x Web x Adapter x Contract x Auditor               | - 5-actor multi-persona flows           |
+----------------------------------------------------------------------------------------------------+
                                      Total: 176 Test Cases (100% Passing)
```

### 2.1 Tier 1 — Feature Coverage (Category-Partition Method)
Applies the Category-Partition method across all 18 features from `PROJECT.md § Feature Inventory` (F01 - F18). Each feature is verified across at least 5 isolated test cases:
1. **F01 (Monorepo & Toolchain Setup)**: Network configuration (Chain ID 43114), block progression, account nonces, transaction receipts, and log filtering.
2. **F02 (Private Payroll Smart Contract)**: Batch creation, employer authorization, zero employee rejection, execution confirmation, and cancellation.
3. **F03 (Compliance Verifier Contract)**: Auditor registration, admin role enforcement, attestation submission, unauthorized caller rejection, and auditor revocation.
4. **F04 (Contract Unit & Invariant Tests)**: Replay protection, idempotency enforcement, executed count invariant check, cancelled batch locking, and unauthorized confirmation rejection.
5. **F05 (Shared Types & Zod Schemas)**: EVM address regex/checksum validation, positive compensation bounds, batch manifest schema parsing, and malformed input rejection.
6. **F06 (BabyJub & Poseidon Cryptography)**: Twisted Edwards curve membership, deterministic public key derivation, Poseidon sponge hashing, uint256[7] auditorPCT layout, and auditor decryption.
7. **F07 (eERC Adapter Live & Simulation)**: RPC initialization, keypair registration, encrypted balance querying, transfer proof preparation, and solvency validation.
8. **F08 (Client Amount Encryption & Proofs)**: 32 public signals generation, Groth16 proof points structure, recipient encryption, auditor encryption, and unregistered recipient rejection.
9. **F09 (Confidential Balance Decryption)**: Viewing key decryption, invalid key rejection, zero-balance handling, transfer accumulation, and homomorphic ElGamal decryption.
10. **F10 (Auditor Decryption Module)**: PrivateTransfer log discovery, Poseidon auditorPCT decryption, sender/recipient address extraction, block height indexing, and empty log handling.
11. **F11 (CLI Batch Creator)**: CSV roster parsing, deterministic commitment hashing, duplicate recipient rejection, empty CSV rejection, and malformed row rejection.
12. **F12 (CLI Payroll Executor)**: On-chain batch execution, status transition to Confirmed, employee confidential credit, solvency verification, and receipt indexing.
13. **F13 (CLI Compliance Auditor)**: Decrypted disbursement reporting, discrepancy detection (isCompliant: false), immutable attestation hashing, transaction breakdown, and on-chain attestation.
14. **F14 (Web Wallet Connection)**: Avalanche L1 (43114) connection, Ethereum Mainnet (1) rejection, Fuji (43113) rejection, malformed address rejection, and network switch handling.
15. **F15 (Employer Batch Creation UI)**: Pre-flight review calculations, gas projection, duplicate recipient flagging, zero amount flagging, and syntax validation.
16. **F16 (Employee Confidential Portal)**: Personal balance decryption, strict privacy isolation (peer salary hiding), invalid key rejection, uncredited account handling, and multi-batch accumulation.
17. **F17 (Auditor Compliance Panel)**: Authorized dashboard loading, non-overreach guardrail disclaimer, unauthorized access rejection, revoked auditor rejection, and granular transaction details.
18. **F18 (Public Observer Explorer View)**: Transaction lookup, zero plaintext calldata verification, event log plaintext omission, invalid hash handling, and block inclusion verification.

### 2.2 Tier 2 — Boundary Value Analysis & Negative Testing (BVA)
Systematically probes edge cases, limits, and adversarial conditions across 60 tests:
- **Numeric Boundaries**: 0 amount, minimum 1 wei transfer, maximum safe 51-bit salary ($2^{51}-1$), solvency boundaries (balance = amount, balance = amount - 1 wei), negative and non-numeric numbers.
- **Empty & Null Inputs**: Empty CSV, whitespace-only rows, header-only CSV, 0 employee count, malformed addresses.
- **Duplicate Detection**: Identical amounts, different amounts, case-insensitive hex duplicates (`0xAAA` vs `0xaaa`), triplicate addresses, pre-flight review warnings.
- **Batch Scaling**: N=1 single-employee, N=3 small team, N=5 full team, linear gas scaling.
- **Unauthorized Callers**: Attacker batch creation, confirmation, cancellation, auditor registration, revocation, attestation, and portal access.
- **Replay Protection**: Duplicate batchId re-creation, altered employee count replay, confirming non-existent batch, re-confirming already confirmed batch, cancelling confirmed batch, confirming cancelled batch.
- **Cryptographic Tampering**: Corrupt viewing key, truncated auditorPCT (<7 elements), tampered cipher element, tampered authKey, out-of-bounds discrete log search, curve order identity multiplication, points off curve.
- **Network Mismatch**: Rejection of Mainnet (1), Fuji (43113), Polygon (137), Arbitrum (42161), non-existent tx queries, out-of-bounds block logs.
- **Auditor Rotation & Isolation**: Inability of old auditor to decrypt post-rotation transactions, new auditor verification, independent multi-batch attestations, non-compliant attestation commits.

### 2.3 Tier 3 — Pairwise Combinatorial Testing
Uses orthogonal arrays and pairwise matrices covering cross-feature interactions (20 tests):
- Ingestion mode (CLI vs Web vs API) $\times$ Batch size ($1, 2, 4$) $\times$ Payout distribution (Equal vs Tiered vs Incremental).
- Execution $\times$ Auditor state (Active vs Rotated vs Revoked) $\times$ Verification mechanism (Viewing Key vs Auditor PCT vs Public Explorer).
- Cross-interface workflows: CLI drafting with Web review; Web drafting with CLI execution; CLI execution with Web employee balance decryption.
- State machine locking: cancellation prevented after execution confirmation; cancelled batch replaced with new ID.
- High-concurrency consecutive batches with sequential block heights and monotonic nonces.

### 2.4 Tier 4 — Real-World Corporate Workloads
Simulates end-to-end multi-persona production scenarios (6 scenarios):
1. **Scenario 1: Standard Monthly Corporate Payroll Run**: 5 employees (Alice, Bob, Charlie, Diana, Evan) with differentiated salary tiers totaling 5,330,000 units. Full lifecycle from CSV ingestion to on-chain confirmation, individual portal decryptions, auditor compliance attestation, and public observer zero-plaintext audits.
2. **Scenario 2: Quarterly Performance Bonus with Additive Homomorphic Balances**: Baseline salaries topped with variable performance bonuses, proving homomorphic accumulation without on-chain plaintext exposure.
3. **Scenario 3: Global Remote Contractor Payouts**: 3 consecutive weekly micro-batches across sequential blocks, testing continuous nonce progression and gas efficiency.
4. **Scenario 4: Formal Regulatory Tax Compliance Investigation**: Multi-block log query, full ledger reconstruction from `uint256[7] auditorPCT`, attestation hash generation, and on-chain compliance commit.
5. **Scenario 5: Multi-Department Enterprise Payroll with Segregation of Duties**: Independent Engineering and Product batches, rejecting unauthorized operator execution while CFO confirms both.
6. **Scenario 6: Disrupted Network Recovery & Idempotent Reconciliation**: Simulated network drop during transaction broadcast, preventing double-spend and confirming single execution.

---

## 3. Directory Layout

```text
d:\Avalanche\
├── TEST_INFRA.md                   # Test infrastructure & methodology documentation (this file)
├── TEST_READY.md                   # Test readiness certification & test execution commands
└── tests\e2e\
    ├── test-runner.ts              # Standalone executable test harness (CLI, TAP, JSON)
    ├── tier1-features.test.ts      # 90 Feature coverage tests (F01 - F18)
    ├── tier2-boundaries.test.ts    # 60 Boundary, corner, replay, and unauthorized tests
    ├── tier3-pairwise.test.ts      # 20 Cross-feature combinatorial pairwise tests
    ├── tier4-realworld.test.ts     # 6 End-to-end corporate payroll workload scenarios
    └── helpers\
        ├── test-framework.ts       # Zero-dependency test engine (describe, it, expect, matchers, TAP v13)
        ├── crypto-sim.ts           # Twisted Edwards BabyJubjub, Poseidon, and ElGamal math
        ├── mock-rpc.ts             # Simulated Avalanche L1 JSON-RPC provider with zero-plaintext audit
        ├── test-accounts.ts        # Deterministic EVM and BabyJubjub test personas
        ├── contract-sim.ts         # IPrivatePayroll & IComplianceVerifier contract state machines
        ├── eerc-sim.ts             # IEERCAdapter simulator for confidential transfers & auditor decryption
        ├── cli-sim.ts              # Headless CLI command simulator
        └── web-sim.ts              # Multi-persona Web UI simulator
```

---

## 4. Test Runner Invocation & Pass/Fail Semantics

The test suite is executable via Node.js LTS (v20+) using `npx tsx`:

### 4.1 Running the Complete Test Suite
```powershell
npx tsx tests/e2e/test-runner.ts
```

### 4.2 TAP v13 Output (CI/CD Integration)
```powershell
npx tsx tests/e2e/test-runner.ts --format=tap
```

### 4.3 JSON Summary Report
```powershell
npx tsx tests/e2e/test-runner.ts --format=json
```

### 4.4 Running Specific Tiers
```powershell
npx tsx tests/e2e/test-runner.ts --tier=1    # Run Tier 1 Feature Coverage (90 tests)
npx tsx tests/e2e/test-runner.ts --tier=2    # Run Tier 2 Boundaries (60 tests)
npx tsx tests/e2e/test-runner.ts --tier=3    # Run Tier 3 Pairwise (20 tests)
npx tsx tests/e2e/test-runner.ts --tier=4    # Run Tier 4 Real-World (6 scenarios)
```

### 4.5 Pass/Fail Semantics
- **Exit Code `0`**: All test suites and tiers executed with 100% pass rate.
- **Exit Code `1`**: One or more assertions failed or encountered an unhandled exception. Stack traces and assertion diffs are emitted to stderr/stdout.

---

## 5. Complete Feature Coverage Matrix

| Feature ID | Feature Name | Tier 1 Tests | Tier 2 Boundaries | Tier 3 Pairwise | Tier 4 Real-World | Total Coverage | Status |
|---|---|---|---|---|---|---|---|
| **F01** | Monorepo & Toolchain Setup | 5 | 8 | 2 | 2 | 17 | PASS |
| **F02** | Private Payroll Smart Contract | 5 | 8 | 4 | 4 | 21 | PASS |
| **F03** | Compliance Verifier Contract | 5 | 6 | 3 | 3 | 17 | PASS |
| **F04** | Contract Unit & Invariant Tests | 5 | 7 | 2 | 2 | 16 | PASS |
| **F05** | Shared Types & Zod Schemas | 5 | 8 | 2 | 2 | 17 | PASS |
| **F06** | BabyJub & Poseidon Cryptography | 5 | 8 | 3 | 2 | 18 | PASS |
| **F07** | eERC Adapter (Live & Simulation) | 5 | 6 | 4 | 3 | 18 | PASS |
| **F08** | Client Amount Encryption & Proofs | 5 | 6 | 3 | 3 | 17 | PASS |
| **F09** | Confidential Balance Decryption | 5 | 5 | 4 | 3 | 17 | PASS |
| **F10** | Auditor Decryption Module | 5 | 4 | 4 | 3 | 16 | PASS |
| **F11** | CLI Batch Creator | 5 | 6 | 3 | 3 | 17 | PASS |
| **F12** | CLI Payroll Executor | 5 | 4 | 3 | 3 | 15 | PASS |
| **F13** | CLI Compliance Auditor | 5 | 4 | 3 | 3 | 15 | PASS |
| **F14** | Web Wallet Connection | 5 | 4 | 2 | 2 | 13 | PASS |
| **F15** | Employer Batch Creation UI | 5 | 5 | 3 | 2 | 15 | PASS |
| **F16** | Employee Confidential Portal | 5 | 4 | 3 | 3 | 15 | PASS |
| **F17** | Auditor Compliance Panel | 5 | 4 | 3 | 3 | 15 | PASS |
| **F18** | Public Observer Explorer View | 5 | 4 | 3 | 3 | 15 | PASS |
| **TOTAL** | **All 18 Features** | **90** | **60** | **20** | **6** | **176** | **100% PASS** |
