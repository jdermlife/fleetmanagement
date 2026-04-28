# Fleet Management System

This repository contains a lightweight fleet management baseline with:

- public-access vehicle and fuel log CRUD
- recent audit history for data mutations
- persistent SQLite storage for core records
- a React frontend for managing fleet records without sign-in
- a simple credit scoring form backed by the API

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
3. Set `VITE_API_URL` if your backend is not running on `http://localhost:5000`
4. Start the app with `npm run dev`

The frontend runs on `http://localhost:5173`.

An example environment file is included in [.env.example](</C:/Users/Jorge/Documents/fleet/fms/.env.example:1>).

## API Surface

- `GET /vehicles`
- `POST /vehicles`
- `PUT /vehicles/:id`
- `DELETE /vehicles/:id`
- `GET /fuel-logs`
- `POST /fuel-logs`
- `PUT /fuel-logs/:id`
- `DELETE /fuel-logs/:id`
- `GET /audit-logs`
- `POST /credit-score`

## Verification

- Backend tests: `..\\.venv\\Scripts\\python.exe -m unittest discover -s tests -v`
- Frontend lint: `npm run lint`
- Frontend build: `npm run build`

## Remaining Limits

- The fleet pages beyond vehicle registry, fuel management, audit trail, and credit scoring are still static placeholders.
- SQLite is fine for small internal deployments but should be replaced for higher concurrency or multi-instance deployments.
- There is no authentication or role-based access control in this build.
- Frontend automated component tests are still not included.
