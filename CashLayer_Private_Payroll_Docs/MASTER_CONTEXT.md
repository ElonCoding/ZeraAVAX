# Master Project Context

## Working name
Private Payroll on L1 CashLayer (final branding TBD)

## Product
A confidential payroll application demonstrating realistic financial workflows using Avalanche's eERC standard and SDK.

## Confirmed problem
Avalanche has an audited eERC standard and SDK, but research found limited application-layer demonstrations of realistic confidential financial workflows.

## USP
Private payroll with encrypted amounts and controlled auditor access.

## Confirmed workflow
1. Employer creates a payroll batch.
2. Employees receive encrypted token payments.
3. Salary amounts and balances remain confidential from unauthorized observers.
4. Authorized auditor can verify compliance through supported controlled access.
5. On-chain transaction evidence supports verification.

## Ecosystem value
Show developers how to build practical applications with eERC and demonstrate adoption beyond infrastructure-level examples.

## Development tools
Codex, Google Antigravity, and Claude Opus are intended to assist development. The human developer remains responsible for review and decisions.

## Unknowns requiring validation
- CashLayer chain ID, RPC, explorer, gas token, network availability
- eERC contracts deployed on CashLayer or deployment procedure
- SDK version, supported APIs, proof-generation workflow
- Token setup and transfer constraints
- Auditor disclosure scope, key custody, rotation, and revocation
- Gas cost, batch limits, indexing requirements
- Final stack, product name, and deployment target

## Ground rules
- Never invent protocol APIs, addresses, or capabilities.
- Treat cryptographic semantics as source-verified.
- Distinguish requirements, assumptions, and decisions.
- Avoid plaintext salary data in logs, analytics, and unnecessary persistence.
- Do not claim successful execution without transaction evidence.
