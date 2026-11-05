# API Specification

## Principle
Prefer direct client-to-chain interaction when appropriate. Introduce a backend only for functionality that cannot safely or reliably be handled client-side.

## Candidate endpoints (only if backend is justified)
- `POST /api/batches` — create non-sensitive application metadata
- `GET /api/batches/:id` — retrieve batch status
- `GET /api/batches` — list authorized metadata
- `POST /api/batches/:id/reconcile` — reconcile tx status (may be internal)
- `GET /api/health` — service health

## Rules
- API must not accept or persist private keys.
- Avoid plaintext salary amounts in request logs.
- Authentication and role authorization required.
- Validate all input with schemas.
- Use idempotency keys for operations that can be retried.
- Return typed errors; never return secrets or stack traces in production.

## TBD
Whether backend is required, auth mechanism, indexing strategy, API versioning, hosting.
