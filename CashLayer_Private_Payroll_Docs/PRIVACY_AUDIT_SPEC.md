# Privacy and Auditor Specification

## Purpose
Define the privacy properties and authorized verification behavior of confidential payroll.

## Required privacy property
Salary amounts and balances must remain confidential from unauthorized observers, subject to the actual guarantees of eERC and any public metadata leakage.

## Auditor requirement
An authorized auditor can verify compliance through the supported eERC access mechanism. The exact disclosure scope must be verified:
- Per-token or global disclosure?
- Per-account or per-transaction?
- Historical or future transactions?
- Selective disclosure or broad visibility?
- Key rotation support?
- Revocation possible? Is it prospective only?
- Who controls auditor key and authorization?
- Can access be delegated?
- What evidence is produced for verification?

## Do not claim until verified
- Employee-specific selective disclosure
- Revocation of prior access
- Auditor sees only one payroll batch
- Auditor cannot see unrelated transactions
- Formal compliance certification

## Application controls
- Least privilege
- Explicit authorization
- Clear disclosure notice
- Audit of authorization actions without leaking amounts
- Key handling aligned with official protocol
- Document residual metadata leakage

## Acceptance
Demonstrate expected access for employer, employee, auditor, and unauthorized observer using separate wallets and test cases.
