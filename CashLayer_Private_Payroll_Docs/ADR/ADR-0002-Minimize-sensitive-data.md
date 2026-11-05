# ADR-0002: Minimize sensitive data persistence

- Status: Proposed
- Context: Payroll amounts and recipient mapping are sensitive.
- Decision: Persist only necessary non-sensitive metadata. Do not store plaintext salary amounts or balances in ordinary database/logging.
- Consequences: Some UI state may be ephemeral; indexing and history design must account for confidentiality.
- Revisit if a specific requirement necessitates protected off-chain data.
