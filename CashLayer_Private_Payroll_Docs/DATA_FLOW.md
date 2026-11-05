# Data Flow

## Payroll creation
1. Employer connects wallet.
2. Frontend validates recipient list and amount inputs.
3. eERC adapter converts inputs into protocol-required encrypted values/proofs.
4. User reviews and signs the required transaction(s).
5. CashLayer executes.
6. Client waits for receipt and reconciles status.
7. App records only necessary metadata and transaction reference.

## Employee verification
1. Employee connects wallet.
2. Client invokes official SDK balance/payment retrieval.
3. SDK returns encrypted/protocol-specific value.
4. Authorized client workflow displays value.
5. No plaintext confidential value is sent to backend unless explicitly justified and protected.

## Auditor workflow
1. Auditor identity/key is configured using verified protocol mechanism.
2. Authorization is established.
3. Auditor performs permitted verification.
4. App presents results and evidence without overstating what was verified.

## Public observer
1. Observer inspects transaction, events, and public state.
2. Protected amounts/balances remain cryptographically unavailable.
3. Metadata leakage is evaluated separately.

## Data classification
- Public: chain ID, contract address, tx hash, public status.
- Sensitive: employee identity mapping, payroll roster, salary inputs.
- Cryptographic: encrypted handles, proof material, auditor keys (classification and storage from official SDK guidance).
- Secret: private keys, seed phrases, credentials — never app-managed or logged.
