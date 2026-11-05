# Database Schema

## Principle
Persist the minimum data required. Confidential amounts and balances should remain in eERC-protected form and should not be stored in plaintext in the ordinary application database.

## Candidate entities
### `payroll_batches`
- `id` (UUID)
- `creator_address` (public wallet address)
- `status` (enum)
- `created_at`
- `submitted_at` (nullable)
- `confirmed_at` (nullable)
- `tx_hash` (nullable)
- `chain_id`
- `contract_address` (nullable)
- `commitment` (nullable, if cryptographically appropriate)
- `metadata_version`

### `batch_recipients` (minimize/consider privacy implications)
- `id`
- `batch_id`
- recipient address or privacy-preserving reference (decision TBD)
- execution status
- transaction reference (if available)

## Do not store
- Private keys or seed phrases
- Plaintext confidential balances
- Plaintext salary amounts unless justified, encrypted at rest, access-restricted, and retention-limited

## Security
Row-level authorization, least privilege, migration discipline, retention/deletion rules, and no sensitive values in logs.
