# Backend Test Modernization Plan

Goal:

Create one coherent backend test strategy centered on the current FastAPI
application, while preserving useful business-rule coverage and retiring stale
Flask-era expectations from release gating.

## Status Update

As of the latest repo pass:

- `test_app.py` and `test_auth.py` have been rewritten against FastAPI
- backend CI no longer relies on the legacy Flask `create_app()` gate
- the Flask runtime entrypoints and Flask-only backend helper modules have been
  removed from the active backend path
- the remaining work is now mostly long-term cleanup and broader coverage
  expansion, not the original test-strategy blocker itself

## Why This Is Needed

The repo currently has two competing backend testing surfaces:

1. current FastAPI routes, services, and authorization behavior
2. older Flask-era tests that still expect `create_app()` and legacy
   `main_flaskold.py` data-access helpers

This split weakens production confidence because:

- passing modern FastAPI tests do not automatically satisfy legacy Flask tests
- CI still references outdated test entrypoints
- some runtime assumptions differ by Python version and app stack

## Current Inventory

### Keep and expand

These are aligned with the current backend direction and should remain active:

- `test_fastapi_auth_smoke.py`
  FastAPI auth/access smoke coverage
- `test_security_permissions.py`
  permission mapping / role behavior
- `test_credit_risk_engine.py`
- `test_credit_scoring_engine.py`
- `test_fraud_scoring_engine.py`
- `test_social_scoring_engine.py`
- `test_psychometric_engine.py`
- `test_quant_scoring_services.py`
- `test_loan_repository_io.py`
- `test_subscription_authorization.py`
- `test_subscription_endpoints_smoke.py`
- `test_loan_authorization.py`
- `test_rls_auth_smoke.py`
- `test_quant_scores_integration.py`

### Rewrite against FastAPI

These tests still target the older Flask surface and should be rewritten to
exercise the active FastAPI runtime:

- `test_app.py`
- `test_auth.py`

Why rewrite:

- they import `create_app()`
- they expect Flask `test_client()`
- they depend on legacy `main_flaskold.py` and model helpers no longer central
  to the current backend

### Legacy / compatibility only

These are not necessarily useless, but they should not be the primary release
gate without explicit product intent:

- `app/main_flaskold.py`
- any compatibility shim that exists only to satisfy the above old tests

If the Flask app is no longer a supported production runtime, it should be
treated as legacy and removed from mainline CI expectations.

## Recommended End State

### Primary test stack

- `pytest` for backend tests as the default runner
- FastAPI `TestClient` for route/API verification
- unit-style tests for pure scoring and service modules
- optional integration tests for database-backed flows

### Runtime policy

- standard test runtime: Python `3.11` or `3.12`
- local Python `3.14` may still be used for limited non-blocking checks, but it
  should not be the source of truth for release gating while some suites
  explicitly skip on `>= 3.13`

## Action Plan

### Phase 1: Stabilize release gating

1. Keep passing modern suites in active CI.
2. Remove `test_app.py` as the primary “existing backend tests” gate in
   `.github/workflows/backend-tests.yml`.
3. Replace that CI step with a curated set of currently supported FastAPI /
   service tests.

Suggested first CI set:

- `test_fastapi_auth_smoke.py`
- `test_security_permissions.py`
- `test_credit_risk_engine.py`
- `test_credit_scoring_engine.py`
- `test_fraud_scoring_engine.py`
- `test_social_scoring_engine.py`
- `test_loan_repository_io.py`
- `test_subscription_authorization.py`
- `test_subscription_endpoints_smoke.py`

### Phase 2: Rewrite legacy Flask tests

Rewrite `test_app.py` and `test_auth.py` to target FastAPI endpoints and
current route prefixes.

Replace:

- Flask `test_client()`
- `create_app()` assumptions
- public unauthenticated behavior that no longer matches current auth posture

With:

- FastAPI `TestClient(app)`
- current auth/session model
- current route paths such as `/api/auth/*`
- role-aware expectations for protected endpoints

### Phase 3: Clarify ownership and support policy

Decide explicitly whether `main_flaskold.py` is:

1. temporary compatibility code
2. a second supported runtime
3. deprecated legacy code pending removal

Recommended direction:

- treat it as deprecated legacy unless there is a business requirement to keep
  the Flask app alive

## CI Recommendation

### Update `.github/workflows/backend-tests.yml`

Current issue:

- it still runs `test_app.py`, which targets the legacy Flask surface

Recommended replacement:

- add a supported pytest/unittest matrix for the modern suites
- keep syntax compilation
- keep auth smoke coverage in Python `3.11`

### Update `.github/workflows/ci-cd-deploy.yml`

Recommended additions:

- run the same modern backend suites used in `backend-tests.yml`
- avoid release confidence depending on only one smoke test plus syntax compile

## Proposed Categorization Table

| Test file | Status | Keep / Rewrite / Retire | Notes |
| --- | --- | --- | --- |
| `test_fastapi_auth_smoke.py` | active | Keep | Good FastAPI auth smoke coverage |
| `test_security_permissions.py` | active | Keep | Valuable permission regression coverage |
| `test_credit_risk_engine.py` | active | Keep | Pure logic, stable |
| `test_credit_scoring_engine.py` | active | Keep | Pure logic, stable |
| `test_fraud_scoring_engine.py` | active | Keep | Pure logic, stable |
| `test_social_scoring_engine.py` | active | Keep | Pure logic, stable |
| `test_psychometric_engine.py` | active | Keep | Pure logic, stable |
| `test_quant_scoring_services.py` | active | Keep | Useful orchestration coverage |
| `test_loan_repository_io.py` | active | Keep | Import/export behavior |
| `test_subscription_authorization.py` | active | Keep | Modern authz coverage |
| `test_subscription_endpoints_smoke.py` | active | Keep | FastAPI route smoke coverage |
| `test_loan_authorization.py` | active | Keep | Route/service authz checks |
| `test_rls_auth_smoke.py` | active | Keep | FastAPI auth smoke |
| `test_quant_scores_integration.py` | active | Keep | Integration-oriented, some DB-dependent skips |
| `test_app.py` | legacy | Rewrite | Flask runtime assumptions |
| `test_auth.py` | legacy | Rewrite | Flask runtime assumptions |

## Definition of Done

The backend test modernization effort is complete when:

1. CI release gating uses only supported FastAPI/service tests
2. `test_app.py` and `test_auth.py` are either rewritten or removed from active
   gating
3. the team documents Python `3.11/3.12` as the backend release-test runtime
4. the repo no longer needs compatibility shims only to satisfy obsolete Flask
   expectations
