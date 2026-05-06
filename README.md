# Fleet Management System

This repository contains a lightweight fleet management baseline with:

- public-access vehicle and fuel log CRUD
- a dedicated Vehicle Master Page ready for PostgreSQL-backed storage
- recent audit history for data mutations
- persistent SQLite storage for core records
- a React frontend for managing fleet records without sign-in
- a simple credit scoring form backed by the API

## Setup

### Prerequisites

- Python 3.8+ and pip (for backend)
- Node.js 16+ and npm (for frontend)

### Backend

1. Navigate to `backend`
2. Create a virtual environment: `python -m venv venv`
3. Activate it:
   - **Windows**: `venv\Scripts\activate`
   - **macOS/Linux**: `source venv/bin/activate`
4. Install dependencies: `pip install -r requirements.txt`
5. (Optional) Set environment variables:
   - Copy `.env.example` to `.env.local` for reference
   - Set `DATABASE_URL` if using PostgreSQL (defaults to SQLite)
6. Start the API: `python -m app.main`

The backend runs on `http://localhost:5000`.

**To connect to PostgreSQL**, set `DATABASE_URL` before starting:
```bash
# Example
export DATABASE_URL="postgresql://user:password@localhost:5432/fleetmanagement"
python -m app.main
```

Production entrypoint: `backend/wsgi.py`

### Frontend

1. Navigate to `frontend`
2. Install dependencies: `npm install`
3. Create a `.env.local` file (copy from `.env.example`):
   ```
   VITE_API_URL=http://localhost:5000
   ```
4. Start the dev server: `npm run dev`

The frontend runs on `http://localhost:5173`.

### Running Both Together

**Terminal 1 (Backend):**
```bash
cd backend
source venv/bin/activate  # or venv\Scripts\activate on Windows
python -m app.main
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm run dev
```

Visit `http://localhost:5173` in your browser. The frontend will automatically connect to `http://localhost:5000`.

### Troubleshooting Connection Issues

If the frontend cannot connect to the backend:

1. **Check backend is running**: Visit `http://localhost:5000/health` in your browser
   - Should return: `{"status": "ok", "database": "connected", ...}`
   
2. **Check CORS**: The backend allows requests from:
   - `http://localhost:5173` (Vite default)
   - `http://localhost:3000` (Create React App default)
   - `http://localhost:5000` (same server)
   
3. **Check firewall**: Ensure port 5000 is not blocked
   
4. **Check environment variables**:
   - Backend: Verify `DATABASE_URL` if using PostgreSQL
   - Frontend: Verify `VITE_API_URL` in `.env.local`
   
5. **Browser console**: Open DevTools (F12) and check for error messages
   - Look for CORS errors or connection refused messages

## API Surface

- `GET /database/status`
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
