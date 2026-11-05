# Privacy Analysis

## Data categories
- Confidential: salary amount, confidential balance, compensation mapping.
- Potentially sensitive metadata: recipient address, payroll participation, timing, batch size.
- Public: chain, contract, transaction hash, events, gas, timestamps.
- Secret: wallet private keys and seed phrases.

## Privacy goals
- Unauthorized observers cannot derive protected amounts/balances.
- App does not leak sensitive amounts through logs, analytics, errors, screenshots, or database.
- Auditor access is limited to verified protocol capability and disclosed scope.
- User understands what remains public.

## Leakage review checklist
- Solidity events and public storage
- transaction calldata and proof data
- frontend logs and telemetry
- API request/response logs
- DB tables and backups
- analytics/crash reports
- explorer metadata
- batch timing and recipient patterns
- wallet address identity correlation

## Required tests
Use separate wallets: employer, employee A, employee B, auditor, and unauthorized observer. Verify each view and document residual leakage.
