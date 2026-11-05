# Operations Runbook

## Pre-demo
- Confirm network/RPC and explorer.
- Confirm contracts and token are configured.
- Verify designated wallets and test funds.
- Run smoke test.
- Clear prior demo state if safe.
- Check wallet extensions and browser.
- Keep fallback recording and known-good transaction references.

## During demo
- Connect employer.
- Create and review batch.
- Submit and wait for confirmed status.
- Show employee verification.
- Show auditor verification.
- Show public transaction evidence and observer privacy.

## Troubleshooting
- Wrong network: switch only to verified chain.
- Wallet rejected: retry only after user confirmation.
- Pending: inspect receipt; do not blindly resend.
- Reverted: decode reason and validate inputs.
- SDK/proof error: capture sanitized diagnostic; consult pinned SDK docs.
- Auditor access issue: verify protocol configuration and permission semantics; do not improvise keys.

## Incident
Stop new payments, preserve sanitized evidence, identify affected batch/tx, notify project owner, avoid key disclosure, and follow documented recovery decision.
