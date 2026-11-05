# System Architecture

## Logical architecture
```text
Employer / Employee / Auditor browser
          |
          v
Web UI + Wallet connector
          |
          +---- Application workflow (batch validation/status)
          |
          +---- eERC client adapter (SDK, proofs, encrypted values)
          |
          +---- EVM adapter (RPC, signing, receipts)
                         |
                         v
                 CashLayer L1
          +---------------------------+
          | Payroll contract(s)      |
          | eERC token/protocol      |
          | events / transaction data|
          +---------------------------+

Optional backend:
- Stores only necessary non-sensitive metadata.
- Indexes/reconciles transaction status.
- Must never custody user private keys.
```

## Trust boundaries
- Browser ↔ wallet
- Browser ↔ RPC/provider
- Browser ↔ optional backend
- Application ↔ eERC cryptographic implementation
- Employer ↔ auditor authorization boundary

## Design constraints
- Do not assume backend can decrypt balances.
- Do not assume auditor key or ACL model; verify official eERC implementation.
- Avoid emitting salary amount or sensitive recipient metadata in public events.
- Separate batch metadata from cryptographic encrypted handles.
- Keep protocol integration behind a replaceable adapter.

## Deployment topology
TBD after CashLayer and eERC deployment support are verified. Do not commit fabricated addresses.
