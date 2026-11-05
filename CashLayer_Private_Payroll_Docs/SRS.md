# Software Requirements Specification (SRS)

## System components
1. Web frontend
2. Wallet integration
3. Application backend (scope TBD; minimize if not required)
4. Payroll contract(s)
5. eERC token/protocol
6. CashLayer RPC and optional indexer
7. Metadata database (if needed)

## Functional requirements
### Wallet
- Connect supported wallet.
- Identify account and network.
- Prompt network switch when required.
- Require wallet signatures for privileged operations.

### Payroll
- Create uniquely identified batch.
- Add recipients and amounts.
- Validate addresses, amounts, duplicates, token availability, and authorization.
- Review before execution.
- Prevent accidental repeat execution.

### Confidential execution
- Use only source-verified eERC interfaces.
- Do not expose plaintext confidential amounts in public UI state.
- Track submitted, pending, confirmed, failed, and unknown outcomes.
- Do not label a transaction successful before confirmation.

### Employee
- View relevant personal payment status.
- Verify own confidential balance using supported SDK flow.
- Never expose another recipient's protected data.

### Auditor
- Follow protocol-verified access model.
- Show the exact authorized disclosure scope.
- Avoid claims of revocation or selective disclosure unless proven.

### History
- Show batch and transaction metadata appropriate for disclosure.
- Link to explorer where available.
- Distinguish chain facts from application metadata.

## Non-functional requirements
Security, privacy, integrity, reliability, accessibility, responsive usability, maintainability, and privacy-safe observability.

## Acceptance criteria
The MVP passes a repeatable end-to-end flow, negative authorization tests, confidentiality checks against unauthorized observers, employee verification, auditor verification, and on-chain evidence checks.
