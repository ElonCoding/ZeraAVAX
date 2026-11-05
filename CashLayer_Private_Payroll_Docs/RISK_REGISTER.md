# Risk Register

| ID | Risk | Probability | Impact | Mitigation / owner |
|---|---|---|---|---|
| R-01 | CashLayer eERC availability not confirmed | TBD | Critical | Validate early; technical lead |
| R-02 | SDK APIs/version mismatch | Medium | High | Pin official release; integration owner |
| R-03 | Auditor disclosure differs from desired UX | TBD | Critical | PoC and explicit decision |
| R-04 | Salary metadata leaks | Medium | High | Threat model, event/storage review |
| R-05 | Batch gas/proof cost too high | TBD | High | Benchmark; reduce MVP scope |
| R-06 | Transaction status reconciliation fails | Medium | High | Receipt-based state machine |
| R-07 | Duplicate payments on retry | Medium | Critical | Idempotency/replay protection |
| R-08 | AI produces incorrect code | High | High | Source verification and tests |
| R-09 | Demo network outage | Medium | High | Backup recording/mock only clearly labeled |
| R-10 | Deadline scope creep | High | High | P0 freeze and milestone gates |

Review and update risks at each milestone.
