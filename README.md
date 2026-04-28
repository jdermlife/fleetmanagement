# Fleet Management System

This repository now contains a small internal-use fleet management baseline with:

- token-based authentication and role-based access control
- one-time bootstrap for the first administrator account
- self-service password change plus admin password reset and user deactivation
- TOTP-based multi-factor authentication with in-app enrollment and login challenge
- one-time backup codes plus admin-assisted MFA recovery for locked-out users
- self-service MFA recovery requests that admins can approve or reject in-app
- persistent vehicle and fuel log CRUD backed by SQLite
- audit logging for security and mutation events
- a React frontend that supports login, user creation, and editable fleet records

## Roles

- `admin`: full access, including user creation, password resets, user deactivation/reactivation, and audit logs
- `manager`: create, update, and delete vehicles and fuel logs
- `viewer`: read-only access to fleet data and credit scoring

## First Run

### Option 1: one-time bootstrap in the UI

1. Start the backend and frontend.
2. Open the frontend.
3. Create the first admin account from the bootstrap screen.

### Option 2: environment-seeded admin

Set these environment variables before starting the backend:

- `FMS_ADMIN_USERNAME`
- `FMS_ADMIN_PASSWORD`
- `FMS_ADMIN_ROLE` (defaults to `admin`)
- `FMS_TOKEN_TTL_HOURS` (defaults to `12`)
- `FMS_MFA_ISSUER` (defaults to `Fleet Management System`)

An example file is included in [.env.example](</C:/Users/Jorge/Documents/fleet/fms/.env.example:1>).

## Setup

### Backend

1. Navigate to `backend`
2. Install dependencies with `pip install -r requirements.txt`
3. Start the API with `python app/main.py`

The backend runs on `http://localhost:5000`.

Production entrypoint:

- WSGI target: `backend/wsgi.py`

### Frontend

1. Navigate to `frontend`
2. Install dependencies with `npm install`
3. Start the app with `npm run dev`

The frontend runs on `http://localhost:5173`.

For production builds, set `VITE_API_URL` to the deployed backend URL before running `npm run build`.

## Verification

- Backend tests: `..\\.venv\\Scripts\\python.exe -m unittest discover -s tests -v`
- Frontend lint: `npm run lint`
- Frontend build: `npm run build`

## Remaining Limits

- SQLite is fine for small internal deployments but should be replaced for higher concurrency or multi-instance deployments.
- There is no email-based recovery flow.
- MFA recovery depends on backup codes or an admin approving a recovery request; there is no automated out-of-band identity proofing.
- Frontend automated component tests are still not included.
- User lifecycle still has limits: there is no rename or hard-delete flow for accounts.
