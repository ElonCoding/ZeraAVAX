# Security Requirements

## General
- Security is a release gate, not a final polish task.
- Pin and review dependencies.
- Never commit secrets.
- Never ask users for seed phrases.
- Use least privilege.
- Validate all user-controlled inputs.
- Keep confidential amounts out of logs and analytics.
- Require human review for cryptographic and access-control decisions.

## Smart contracts
- Explicit role checks
- Replay/duplicate protection
- Safe state transitions
- No arbitrary owner recording that misrepresents payment completion
- Review external calls and reentrancy
- Fuzz and invariant tests
- Static analysis
- Compiler/dependency pinning

## Frontend/backend
- Wallet/chain validation
- Schema validation
- Safe error handling
- Authentication and authorization
- Rate limits if backend exists
- CSP and secure headers for deployment
- Privacy-safe telemetry

## Release gates
1. All tests pass.
2. No known critical/high unresolved issue.
3. eERC assumptions source-verified.
4. Privacy review completed.
5. Deployment addresses and configuration independently checked.
6. Demo rehearsed using designated wallets.
