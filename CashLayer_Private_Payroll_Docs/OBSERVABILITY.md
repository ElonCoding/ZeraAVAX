# Observability

## Track
- Frontend errors
- Wallet connection/network state
- Transaction submission and receipt state
- RPC failures and latency
- Batch lifecycle reconciliation
- SDK/proof-generation errors (redacted)

## Privacy constraints
Never log plaintext salary amounts, decrypted balances, private keys, seed phrases, sensitive proof inputs, or confidential recipient mappings.

## Metrics (initial)
- Batch creation success/failure
- Transaction submitted/confirmed/reverted
- RPC timeout rate
- Proof-generation duration
- Batch execution duration
- Reconciliation backlog

Metrics must be aggregated and not reveal individual payroll details.
