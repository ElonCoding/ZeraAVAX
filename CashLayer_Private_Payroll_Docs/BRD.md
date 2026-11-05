# Business Requirements Document (BRD)

## Executive summary
Demonstrate confidential payroll as a practical financial application of Avalanche eERC on L1 CashLayer.

## Business problem
Payroll requires compensation privacy. Public-chain transparency can expose salary amounts and balances. eERC provides infrastructure, but practical application-layer demonstrations of realistic confidential workflows are limited.

## Business opportunity
Deliver:
- A useful confidential payroll product
- A reference implementation for developers
- A concrete eERC ecosystem demonstration
- A foundation for future confidential financial applications

## Objectives
| ID | Objective |
|---|---|
| BO-01 | Demonstrate confidential payroll |
| BO-02 | Protect salary amounts and balances |
| BO-03 | Support controlled auditor verification |
| BO-04 | Preserve on-chain verifiability |
| BO-05 | Demonstrate eERC application adoption |

## Scope
### Included
Payroll batch preparation, confidential token transfers, recipient verification, authorized auditing, transaction status/evidence, application access control.

### Excluded
HR lifecycle management, tax filing, banking/fiat rails, legal certification, production enterprise integrations.

## Assumptions to validate
CashLayer supports the intended eERC workflow; users have compatible wallets; selected token can be used; auditor functionality supports required disclosure; test environment is accessible.

## Business risks
| Risk | Severity | Response |
|---|---|---|
| eERC unavailable on target CashLayer | Critical | Validate before building dependent features |
| SDK/API mismatch | High | Pin versions and source-check |
| Auditor capability differs from expectations | Critical | Prove semantics in PoC |
| Metadata leaks sensitive information | High | Threat model events, logs, and storage |
| Gas/batch constraints | Medium/High | Benchmark representative batches |
| Demo network instability | High | Prepare backup demo and reproducible script |
| AI-generated false APIs | High | Require citations/source and tests |
