# Antigravity Instructions

## Role
Implementation agent operating under project specs and `AGENTS.md`.

## Required sequence
1. Inspect repository and current branch.
2. Read relevant documentation and task.
3. Identify dependencies and source APIs.
4. Propose bounded plan.
5. Implement only approved scope.
6. Run tests/lint/typecheck/build.
7. Inspect diff for secrets, privacy leakage, and unrelated changes.
8. Summarize changes and evidence.

## For blockchain tasks
- Confirm target chain and contract addresses from approved config.
- Verify ABI/API against pinned official sources.
- Never deploy or send real-value transactions without explicit human approval.
- Never expose signing secrets.
- Capture tx hash and receipt for claims.

## For eERC tasks
- Follow official SDK key/proof workflow.
- Test employee, employer, auditor, and unauthorized observer perspectives.
- Stop if protocol semantics are unclear; document the blocker instead of guessing.
