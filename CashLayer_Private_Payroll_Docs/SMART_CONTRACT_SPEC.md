# Smart Contract Specification

## Purpose
Define the minimal on-chain logic required for payroll workflow integrity while relying on official eERC infrastructure for confidential token operations.

## Contract boundaries
Avoid duplicating eERC token/protocol functionality. Payroll contract should only implement application-level features that cannot be safely handled client-side.

## Candidate responsibilities (validate before implementation)
- Employer/administrator authorization
- Batch identifier and lifecycle
- Batch commitment/hash if needed
- Replay/duplicate execution protection
- Minimal status events
- Optional approval mechanism

## Candidate state model
`Draft -> Ready/Approved -> Submitted -> Confirmed`
Failure states may include `Failed` or `Cancelled` only if cancellation semantics are safe and defined. Do not assume submitted blockchain transactions can be cancelled.

## Security requirements
- Explicit access control
- Checks-effects-interactions where relevant
- Reentrancy protection if external calls create risk
- Input validation
- Replay protection
- Safe event design
- No plaintext salary amounts in public storage/events
- No owner-only arbitrary record operation that can misrepresent payment execution
- Tests for unauthorized access and duplicate batch operations

## Interface and event design
To be designed after eERC interface verification. Events must avoid leaking employee/payroll metadata unnecessarily.

## Verification
Foundry unit tests, fuzz tests, invariant tests, static analysis, deployment tests, and independent review.
