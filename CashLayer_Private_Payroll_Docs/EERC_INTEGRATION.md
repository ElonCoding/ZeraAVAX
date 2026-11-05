# Avalanche eERC Integration Specification

## Objective
Integrate the official Avalanche eERC standard and SDK into the payroll workflow.

## Source of truth
- Official docs: https://docs.avax.network/integrations/encrypted-erc
- Contracts: https://github.com/ava-labs/EncryptedERC
- SDK: https://github.com/ava-labs/eerc-sdk

## Mandatory validation
1. Confirm CashLayer is an Avalanche L1 and identify its chain ID/RPC.
2. Confirm eERC contracts are deployed there or determine supported deployment procedure.
3. Pin official SDK and contract versions.
4. Read exact API signatures and examples.
5. Validate token initialization and user registration requirements.
6. Execute a minimal confidential transfer.
7. Verify sender/recipient balance behavior.
8. Test unauthorized observer behavior.
9. Validate auditor disclosure, key custody, rotation, and revocation semantics.
10. Benchmark gas, proof latency, and batch constraints.

## Adapter design
Create a narrow adapter with functions conceptually covering:
- initialization/registration
- encrypt or encode amount
- prepare proof
- confidential transfer
- encrypted balance retrieval
- authorized disclosure/verification
- transaction status and receipt

Names and signatures must be taken from the pinned SDK, never invented.

## Security
- Follow SDK key-management guidance.
- Do not transmit private keys to backend.
- Avoid plaintext amount logging.
- Treat proof failures and unknown transaction states explicitly.
- Add integration tests against the intended network.

## Exit criteria
A repeatable demo proves confidential transfer, recipient verification, observer confidentiality, and the intended auditor workflow.
