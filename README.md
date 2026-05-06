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
- PostgreSQL connection (Neon cloud, local instance, or other provider)

### Backend

1. Navigate to `backend`
2. Create a virtual environment: `python -m venv venv`
3. Activate it:
   - **Windows**: `venv\Scripts\activate`
   - **macOS/Linux**: `source venv/bin/activate`
4. Install dependencies: `pip install -r requirements.txt`
5. Set `DATABASE_URL` environment variable (optional - uses Neon by default):
   ```bash
   # Windows PowerShell:
   $env:DATABASE_URL = "postgresql://user:password@host:5432/database"
   
   # macOS/Linux:
   export DATABASE_URL="postgresql://user:password@host:5432/database"
   
   # Or create backend/.env.local:
   DATABASE_URL=postgresql://user:password@host:5432/database
   ```
6. Initialize the database (optional - auto-initialized on first run):
   ```bash
   python setup_db.py
   ```
7. Start the API: `python -m app.main`

The backend runs on `http://localhost:5000`.

**Database Engine**: PostgreSQL only (no SQLite fallback)
- **Default**: Neon PostgreSQL (cloud-hosted)
- **Override**: Set `DATABASE_URL` to any PostgreSQL-compatible database
- Examples:
  - Local: `postgresql://user:password@localhost:5432/fleet`
  - Supabase: `postgresql://user:password@db.supabase.co:5432/postgres`
  - Railway: `postgresql://user:password@railway.internal:5432/railway`

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
   
2. **Check DATABASE_URL is set**: 
   - Backend requires `DATABASE_URL` environment variable
   - Verify it's set before starting the backend:
     ```bash
     # Windows: $env:DATABASE_URL
     # macOS/Linux: echo $DATABASE_URL
     ```
   - If not set, the default Neon PostgreSQL URL is used
   
3. **Check database connection**:
   - Verify PostgreSQL database is accessible at the URL
   - Test connection: `psql <DATABASE_URL>`
   - Check firewall/network rules
   
4. **Check CORS**: The backend allows requests from:
   - `http://localhost:5173` (Vite default)
   - `http://localhost:3000` (Create React App default)
   - `http://localhost:5000` (same server)
   
5. **Check frontend configuration**:
   - Verify `VITE_API_URL` in `frontend/.env.local`:
     ```
     VITE_API_URL=http://localhost:5000
     ```
   
6. **Browser console**: Open DevTools (F12) and check for error messages
   - Look for CORS errors or connection refused messages
   - Check `[API]` logs showing request/response activity
   
7. **Backend logs**: Check console output for database connection errors
   - PostgreSQL connection failures
   - Missing DATABASE_URL environment variable
   - Authentication issues

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
