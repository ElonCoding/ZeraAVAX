# Smart Contract Test Specification

## Unit tests
- Owner/admin setup and transfer of control (if implemented)
- Role restrictions
- Batch ID uniqueness
- Valid state transitions
- No transition from terminal state
- Recipient validation
- Duplicate/replay prevention
- Events do not contain confidential amounts
- Payment execution state matches actual protocol outcome

## Fuzz tests
- Arbitrary addresses
- Batch sizes
- State transitions
- Repeated calls
- Invalid role combinations
- Boundary values

## Invariants (adapt to final design)
- A batch cannot be executed twice.
- Unauthorized accounts cannot create/execute privileged batches.
- Terminal batch state cannot be silently altered.
- App contract never stores plaintext salary amounts.
- Recorded successful execution requires evidence consistent with transaction result.

## Integration
- Deploy to local test environment.
- Connect actual eERC contracts/SDK.
- Execute transfer and inspect receipt.
- Verify role and privacy behavior with multiple wallets.

## Tooling
Foundry (`forge test`, fuzz, invariant), static analyzer, dependency review. Exact setup TBD.
