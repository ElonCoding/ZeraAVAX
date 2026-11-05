# Deployment Guide

## Status
Deployment steps cannot be finalized until CashLayer network and eERC deployment details are verified.

## Prerequisites
- Verified chain ID, RPC, explorer, gas token
- Pinned Solidity/Foundry versions
- Verified eERC SDK/contracts and addresses
- Deployment wallet funded with appropriate test/native token
- `.env` configured locally and excluded from Git
- Tests passing

## Procedure (template)
1. Install pinned dependencies.
2. Run formatter, lint, unit, fuzz, and integration tests.
3. Verify target chain configuration.
4. Deploy only required contracts.
5. Verify deployed addresses and constructor parameters.
6. Run smoke tests.
7. Publish deployment manifest with chain ID, addresses, commit, compiler, and timestamp.
8. Configure frontend using verified public addresses.
9. Test wallet connection and end-to-end workflow.
10. Record limitations and rollback/recovery options.

## Never
- Commit private keys.
- Copy addresses from unverified sources.
- Claim a deployment succeeded without transaction receipts.
