# Threat Model

## Assets
- Salary amounts
- Employee identity/recipient mapping
- Encrypted balances and protocol handles
- Wallet keys and signing authority
- Auditor keys/permissions
- Payroll batch integrity
- Transaction correctness
- Application credentials and metadata

## Adversaries
- Public blockchain observer
- Malicious or compromised user
- Unauthorized employer/operator
- Compromised frontend or dependency
- Compromised backend/database
- Malicious recipient input
- RPC/indexing manipulation
- Compromised auditor key
- AI-generated vulnerable code

## Threats and controls
| Threat | Controls |
|---|---|
| Unauthorized payroll | Contract access control, wallet authorization |
| Duplicate batch execution | Unique IDs, replay protection, idempotency |
| Salary leakage | eERC guarantees verified, privacy-safe logs/events/storage |
| Auditor overreach | Least privilege; validate protocol semantics |
| Key compromise | Wallet custody, no key collection, rotation procedures |
| Phishing/malicious UI | Clear signing prompts, verified addresses, dependency hygiene |
| RPC false status | Receipt verification and confirmations |
| Batch tampering | Immutable commitments/state transitions where appropriate |
| AI hallucinated APIs | Source-check, compile, tests, pinned dependencies |

## Residual risks
Protocol-level metadata leakage, auditor key scope, and revocation limitations are TBD until source and PoC verification.
