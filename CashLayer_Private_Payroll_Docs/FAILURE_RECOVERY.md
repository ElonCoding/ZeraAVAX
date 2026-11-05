# Failure and Recovery

## State vocabulary
Draft, Ready, Submitted, Pending, Confirmed, Failed, Unknown/ReconciliationRequired. Final states and transitions must be specified by implementation.

## Rules
- Never equate wallet submission with confirmation.
- Never retry a transaction blindly.
- Check transaction hash/nonce/receipt before retry.
- Idempotency key or batch ID must prevent duplicate execution where possible.
- A chain transaction generally cannot be cancelled after broadcast; UI must state this accurately.
- Failed transactions may consume gas.
- Unknown state must trigger reconciliation, not success.

## Recovery scenarios
- Wallet rejection: return to review.
- RPC outage: retain safe non-sensitive state; retry read operations.
- Submission timeout: search/reconcile before resubmission.
- Revert: inspect reason, correct input, create a new authorized attempt.
- Frontend reload: reconstruct status from chain/metadata without storing secrets.
- Auditor key problem: follow official key recovery/rotation process; do not claim prior access revoked without proof.
