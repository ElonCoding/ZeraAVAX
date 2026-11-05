# System Requirements Document (SRD)

## Development prerequisites
- Git and GitHub
- Node.js version compatible with selected framework/SDK
- Package manager pinned in repository
- Foundry toolchain
- Solidity compiler version selected from dependency compatibility
- Compatible EVM wallet
- CashLayer RPC and explorer information
- Official Avalanche eERC SDK/contracts
- Codex, Antigravity, Claude Opus

## Network configuration to verify
| Parameter | Value |
|---|---|
| Network name | TBD / verify |
| Chain ID | TBD / verify |
| RPC | TBD / verify |
| Explorer | TBD / verify |
| Gas token | TBD / verify |
| eERC contract addresses | TBD / verify |
| SDK version | TBD / verify |
| Deployment procedure | TBD / verify |

## Runtime
- Modern browser with wallet support.
- HTTPS for hosted environments.
- Backend runtime only if required by architecture.
- Database only for necessary non-sensitive metadata.

## Storage restrictions
Do not store seed phrases, private keys, plaintext balances, or confidential salary amounts in logs, analytics, or ordinary persistence. If sensitive off-chain data is essential, document encryption, access control, retention, and deletion.

## Environment separation
Local, integration/test, and demo/production-like environments must use distinct wallets, RPCs, secrets, and deployment addresses.

## Performance
Measure proof-generation time, transfer latency, gas, batch-size constraints, RPC reliability, and UI responsiveness before setting numerical SLOs.
