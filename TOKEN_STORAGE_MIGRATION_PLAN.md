# Token Storage Migration Plan

## Objective

Remove access and refresh tokens from `localStorage`, `sessionStorage`, URLs, and other JavaScript-readable persistent stores. This is a coordinated frontend and FastAPI protocol migration, not a storage-key relocation.

Target browser model:

- Refresh token: rotated, server-set cookie with `HttpOnly`, `Secure`, `SameSite=Lax`, and `Path=/api/auth`.
- Access token: short-lived bearer token held only in frontend memory.
- Browser startup: restore a session by calling the refresh endpoint with the cookie; never read the refresh token in JavaScript.
- Logout: revoke the server session and expire the cookie in the same response.
- CSRF: validate `Origin` on cookie-authenticated mutation endpoints and require a non-secret CSRF header/token where needed.
- Browser API routing: prefer the Vercel same-origin `/api` proxy. Cross-origin credentialed requests remain restricted to the configured frontend origin allowlist.

Do not move authentication tokens to IndexedDB, another Web Storage key, a service-worker cache, a JavaScript-readable cookie, or serialized application state.

## FastAPI Contract

1. Add cookie helpers with production-safe defaults and environment-specific development behavior.
2. On login, registration, Google sign-in, and Apple sign-in:
   - Create the existing server-side `AuthSession` record.
   - Set the rotated refresh token cookie.
   - Return the access token and user payload, but no refresh token in the final contract.
3. On refresh:
   - Read the refresh token only from the HttpOnly cookie in the final contract.
   - Verify and rotate it using the existing hashed session record.
   - Revoke the prior session, set the replacement cookie, and return a new access token.
4. On logout, account deletion, password reset, and session revocation:
   - Revoke applicable server sessions.
   - Expire the refresh cookie with the same name, path, domain, and security attributes used when setting it.
5. Reject cookie-authenticated refresh/logout requests with an unapproved or missing browser `Origin`. Add CSRF protection before any general-purpose cookie-authenticated mutation endpoint is introduced.
6. Keep CORS credentials enabled only with explicit origins. Never combine credentialed CORS with a wildcard origin.
7. Ensure OAuth callbacks never place access or refresh tokens in redirect query parameters. Use a short-lived, one-time authorization code or a server-established cookie before redirecting to the frontend.

## Frontend Contract

1. Configure the API client with credentials for browser requests and continue using the same-origin `/api` route in production.
2. Keep the access token in module memory only. Attach it as a bearer token while valid.
3. On application startup, call refresh once to recover an authenticated session. Render authentication loading state until that request resolves.
4. On a `401`, use the existing single-flight refresh behavior, then retry the original request once. Prevent refresh loops.
5. Remove refresh-token request bodies and all JavaScript refresh-token getters.
6. Remove access and refresh token writes and reads from Web Storage. During migration, delete the legacy `auth_token` and `refresh_token` keys on startup and logout.
7. Do not use token presence as the authenticated-state check. Use the bootstrapped current-user/session state.
8. Keep non-secret preferences and drafts in Web Storage only after confirming they contain no credentials or authentication artifacts.

## Native Clients

Capacitor clients must be tested separately before the browser contract becomes mandatory. Prefer an OS-managed cookie jar when it preserves HttpOnly semantics across native HTTP and WebView requests. If that is not reliable, use platform secure credential storage through a native bridge for the refresh credential; never expose it to the web bundle or Web Storage. Keep the access token memory-only.

The backend should identify supported client channels explicitly rather than weakening browser cookie attributes for native compatibility.

## Coordinated Rollout

### Phase 1: Backend Compatibility

- Add cookie issuance and cookie-based refresh while temporarily retaining the existing JSON/body refresh contract behind a migration flag.
- Add Origin/CSRF checks, cookie deletion, OAuth one-time-code handling, and metrics for cookie versus legacy refresh use.
- Do not enable the final cookie-only mode until staging validates browser and native clients.

### Phase 2: Frontend Migration

- Deploy credentialed requests, memory-only access tokens, startup refresh, and legacy-key deletion.
- Stop consuming refresh tokens from responses and stop sending them in request bodies.
- Verify login, registration, OAuth, reload recovery, concurrent `401` handling, logout, password reset, and account deletion.

### Phase 3: Backend Enforcement

- Stop returning refresh tokens in JSON and reject body refresh tokens for browser clients.
- Remove tokens from OAuth redirects.
- Disable and then delete the compatibility flag after telemetry shows no supported client using the legacy path.
- Shorten access-token lifetime if necessary now that silent cookie refresh is available.

### Phase 4: Cleanup and Enforcement

- Remove obsolete frontend token-storage code and backend request fields.
- Confirm logs, analytics, crash reports, URLs, and browser storage contain no tokens.
- Move CSP from report-only to enforcement only after violation reports show required production flows are covered.

## Release Gates

- FastAPI tests verify exact cookie attributes, rotation, replay rejection, revocation, expiry, Origin/CSRF rejection, and absence of refresh tokens in response bodies.
- Frontend tests verify no token storage calls, one startup refresh, single-flight refresh, one retry maximum, and complete logout cleanup.
- End-to-end tests cover Vercel same-origin production behavior plus Google, Apple, PayPal, Turnstile, and supported Capacitor clients.
- Security review confirms no JavaScript-readable persistent auth credential and no token-bearing OAuth redirect.
- Rollback re-enables the bounded compatibility contract; it must not reintroduce new Web Storage writes.