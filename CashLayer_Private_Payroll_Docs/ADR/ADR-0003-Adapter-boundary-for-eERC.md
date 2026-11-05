# ADR-0003: Isolate eERC behind an adapter

- Status: Proposed
- Context: SDK APIs and deployment details must be source-verified and may evolve.
- Decision: Encapsulate eERC calls in a small adapter/service boundary.
- Consequences: Application logic remains testable; adapter requires integration tests against pinned official SDK.
