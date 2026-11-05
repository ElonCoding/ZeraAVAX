# Product Requirements Document (PRD)

## 1. Overview
Private Payroll on L1 CashLayer is a confidential payroll application using Avalanche eERC to demonstrate realistic encrypted financial workflows.

## 2. Problem
Public blockchain transactions can expose amounts and balances. This is unsuitable for sensitive compensation workflows. While Avalanche provides an audited eERC standard and SDK, application-layer examples of realistic confidential financial workflows are limited.

## 3. Vision
Enable organizations to execute confidential, verifiable payroll payments on blockchain infrastructure.

## 4. Goals
- Create payroll batches.
- Execute encrypted token payments to employees.
- Keep amounts and balances confidential from unauthorized observers.
- Support controlled auditor verification.
- Provide on-chain transaction evidence.
- Deliver a practical developer reference implementation for eERC.

## 5. Actors
- Employer / payroll operator
- Employee / recipient
- Authorized auditor
- Public observer
- Application administrator (if needed; permissions TBD)

## 6. MVP functional requirements
- Wallet connection and network detection.
- Employer authorization.
- Payroll batch creation and review.
- Recipient and amount validation.
- Confidential transfer execution through verified eERC interfaces.
- Batch lifecycle and transaction tracking.
- Employee payment/balance verification.
- Controlled auditor access and compliance verification.
- Transaction evidence and explorer link where available.
- Error handling and duplicate-execution protection.

## 7. Non-functional requirements
- Security: privileged actions authenticated and authorized.
- Privacy: avoid disclosure through UI, storage, logs, analytics, and events.
- Integrity: batches and execution records must be consistent.
- Reliability: track pending, confirmed, failed, and unknown states.
- Usability: provide clear confirmations and error messages.
- Maintainability: modular, documented, testable code.
- Observability: diagnostic telemetry must not include secrets or plaintext confidential amounts.

## 8. Non-goals for MVP
- Full HR suite
- Tax filing or statutory compliance automation
- Fiat rails or banking integration
- Multi-chain support
- Enterprise payroll integrations
- Legal/regulatory certification
- Recurring payroll unless time permits

## 9. Priorities
### P0
Wallet, batch creation, confidential transfer, employee verification, auditor workflow, transaction status, security and integration tests.

### P1
CSV import, batch history, improved recovery, demo-mode guidance, richer filters.

### P2
Recurring payroll, scheduling, multiple assets, enterprise integrations, multi-L1 support.

## 10. Success criteria
- A payroll batch executes successfully end-to-end.
- More than one recipient can receive confidential payments.
- Unauthorized observer cannot reveal protected amounts/balances.
- Employee can verify their own payment.
- Authorized auditor can perform the defined verification.
- On-chain transaction evidence is independently inspectable.
- Demo can be repeated reliably.

## 11. Open decisions
Token/asset, network, batch limits, auditor disclosure semantics, key rotation/revocation, multisig/approval needs, final branding.
