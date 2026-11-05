# Wallet Integration Specification

## Requirements
- Connect compatible EVM wallet.
- Display shortened address and network.
- Detect unsupported or incorrect chain.
- Request network switch only when supported.
- Prompt signatures only for necessary actions.
- Show transaction lifecycle clearly.
- Disconnect/reset client state safely.

## Security
- Never request or store seed phrases/private keys.
- Never sign opaque transactions without explaining purpose.
- Validate target chain and contract address.
- Do not trust frontend role state for on-chain authorization.
- Handle rejected signatures and wallet disconnection.

## UX states
Disconnected, connecting, connected, wrong network, awaiting signature, submitted, pending, confirmed, failed, unknown/reconciliation.

## Compatibility
Wallet list and CashLayer support are TBD until verified.
