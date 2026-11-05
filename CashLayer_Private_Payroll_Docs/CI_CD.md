# CI/CD

## Pull request checks
- Formatting
- Linting
- Type checking
- Frontend unit tests
- Backend tests (if backend exists)
- Foundry unit tests
- Fuzz/invariant tests at appropriate CI budget
- Solidity static analysis
- Dependency vulnerability scan
- Build

## Branch strategy
- `main`: stable, demo-ready
- feature branches: one scoped task each
- PRs: tests and checklist required

## Secrets
Use CI secret store. Never expose secrets in logs or artifacts. Use dedicated low-privilege test keys only when unavoidable; prefer local signing and mock environments.

## Release
Tag release, record commit, compiler/dependency versions, chain ID and deployment addresses, test results, and known limitations.
