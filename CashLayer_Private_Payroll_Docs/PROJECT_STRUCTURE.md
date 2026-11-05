# Proposed Project Structure

```text
private-payroll/
├── README.md
├── AGENTS.md
├── CLAUDE.md
├── ANTIGRAVITY.md
├── AI_CONTEXT.md
├── .env.example
├── apps/
│   └── web/                 # frontend (if monorepo)
├── packages/
│   ├── eerc-adapter/        # source-verified SDK wrapper
│   ├── shared/              # shared types and validation
│   └── ui/                  # optional shared UI
├── contracts/
│   ├── src/
│   ├── test/
│   ├── script/
│   └── foundry.toml
├── backend/                  # only if required
├── docs/
│   ├── architecture/
│   ├── blockchain/
│   ├── security/
│   ├── testing/
│   ├── operations/
│   ├── product/
│   ├── hackathon/
│   └── adr/
└── scripts/
```

Adjust to the existing repository rather than forcing this structure.
