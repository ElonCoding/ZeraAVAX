# Frontend Specification

## UX objective
Make confidential payroll understandable and trustworthy while accurately communicating transaction state and privacy limitations.

## Candidate screens
1. Landing / connect wallet
2. Employer dashboard
3. Create payroll batch
4. Review and confirm batch
5. Batch execution progress
6. Batch detail/history
7. Employee payment/balance view
8. Auditor verification view
9. Network/error/empty states

## Design requirements
- Clearly distinguish encrypted/private values from public metadata.
- Never imply a transaction is confirmed before receipt.
- Provide accessible form validation.
- Confirm before irreversible submission.
- Display batch state and explorer evidence.
- Avoid showing sensitive information in screenshots/demo mode.
- Responsive layout and keyboard accessibility.

## Components
WalletButton, NetworkStatus, BatchForm, RecipientRow, BatchReview, TransactionStatus, ConfidentialValue, BalancePanel, AuditorVerificationPanel, ErrorNotice.

## State management
Keep cryptographic and transaction state close to relevant components/adapters. Avoid unnecessary persistence of sensitive data.
