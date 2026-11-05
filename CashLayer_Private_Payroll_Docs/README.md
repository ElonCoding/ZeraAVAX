# CashLayer Private Payroll — Documentation Package

This documentation package describes a confidential payroll application on L1 CashLayer using Avalanche eERC.

## Confirmed project definition
- **Problem:** Avalanche has an audited eERC standard and SDK, but research found limited application-layer demonstrations of realistic confidential financial workflows.
- **USP:** Private payroll with encrypted amounts and controlled auditor access.
- **Workflow:** Employer creates a payroll batch; employees receive encrypted token payments; amounts and balances remain confidential; authorized auditor verifies compliance; on-chain transaction verification is available.
- **Ecosystem value:** A concrete demonstration of eERC adoption and a reference implementation for developers.

## Important
This package is a planning baseline. CashLayer-specific technical details, contract addresses, chain ID, RPC, SDK API signatures, auditor disclosure granularity, and revocation semantics must be validated against official sources before implementation.

## Contents
- Product and business: `PRD.md`, `BRD.md`, `SRS.md`, `SRD.md`
- Technical: `TRD.md`, `ARCHITECTURE.md`, `DATA_FLOW.md`
- Blockchain: `SMART_CONTRACT_SPEC.md`, `EERC_INTEGRATION.md`, `WALLET_SPEC.md`, `PRIVACY_AUDIT_SPEC.md`
- Application: `API_SPEC.md`, `DATABASE_SCHEMA.md`, `FRONTEND_SPEC.md`, `USE_CASES.md`, `USER_STORIES.md`
- Security and QA: `SECURITY.md`, `THREAT_MODEL.md`, `PRIVACY_ANALYSIS.md`, `RISK_REGISTER.md`, `TEST_PLAN.md`, `CONTRACT_TESTS.md`
- Operations: `DEPLOYMENT.md`, `CI_CD.md`, `OBSERVABILITY.md`, `RUNBOOK.md`, `FAILURE_RECOVERY.md`
- AI workflow: `AGENTS.md`, `CLAUDE.md`, `ANTIGRAVITY.md`, `AI_CONTEXT.md`, `SKILLS_MATRIX.md`
- Delivery: `ROADMAP.md`, `IMPLEMENTATION_PLAN.md`, `TASKS.md`, `SUBMISSION.md`, `DEMO_SCRIPT.md`, `PITCH_DECK.md`, `JUDGING_CRITERIA.md`, `FUTURE_SCOPE.md`
