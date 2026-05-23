# PostgreSQL-Only Configuration Guide

## Overview

The Fleet Management System backend has been updated to use **PostgreSQL exclusively**. SQLite fallback has been removed. All database operations now require a valid PostgreSQL connection via the `DATABASE_URL` environment variable.

## Database Configuration

### Default: Neon PostgreSQL (Cloud-Hosted)

```
postgresql://neondb_owner:npg_dk2jBpcHxl5h@ep-curly-fog-aqoz9uli-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

This URL is used automatically if `DATABASE_URL` is not set.

### Custom PostgreSQL Databases

To use a different PostgreSQL database, set the `DATABASE_URL` environment variable:

#### Local PostgreSQL
```bash
export DATABASE_URL="postgresql://user:password@localhost:5432/fleet_management"
```

#### Supabase
```bash
export DATABASE_URL="postgresql://user:password@db.supabase.co:5432/postgres"
```

#### Railway
```bash
export DATABASE_URL="postgresql://user:password@railway.internal:5432/railway"
```

#### Any PostgreSQL Provider
```bash
export DATABASE_URL="postgresql://user:password@host:port/database"
```

## Files Modified

### 1. [backend/app/main.py](backend/app/main.py)
- **Lines 48-54**: Removed SQLite path, added PostgreSQL URL configuration with environment variable support
- **Lines 78-91**: Updated to require PostgreSQL with validation
- Changes:
  - Uses `os.getenv("DATABASE_URL", DEFAULT_URL)` to support environment overrides
  - Removes fallback to SQLite
  - Raises error if PostgreSQL connection fails

### 2. [backend/app/models.py](backend/app/models.py)
- **Lines 358-396**: Updated `resolve_database_config()` function
- Changes:
  - Requires `DATABASE_URL` parameter
  - Rejects SQLite paths completely
  - Improved error messages for PostgreSQL-only setup
  - Removed SQLite fallback logic

### 3. [backend/setup_db.py](backend/setup_db.py)
- **Lines 1-17**: Updated database setup script
- Changes:
  - Uses `os.getenv("DATABASE_URL", DEFAULT_URL)` 
  - Passes `None` for database_path (no SQLite)
  - Reports only PostgreSQL configuration

### 4. [backend/.env.example](backend/.env.example)
- Updated to show PostgreSQL-only configuration
- Includes examples for various PostgreSQL providers

### 5. [README.md](README.md)
- Updated setup instructions for PostgreSQL-only backend
- Clarified DATABASE_URL requirement
- Added examples for multiple PostgreSQL providers
- Updated troubleshooting section

## Running the Backend

### With Default Neon PostgreSQL

```bash
cd backend
source venv/bin/activate  # or venv\Scripts\activate on Windows
python -m app.main
```

The backend will automatically use the Neon PostgreSQL database configured in `main.py`.

### With Custom PostgreSQL Database

#### Option 1: Environment Variable (Windows PowerShell)
```powershell
$env:DATABASE_URL = "postgresql://user:password@localhost:5432/fleet"
cd backend
.\.venv\Scripts\activate
python -m app.main
```

#### Option 2: Environment Variable (macOS/Linux)
```bash
export DATABASE_URL="postgresql://user:password@localhost:5432/fleet"
cd backend
source venv/bin/activate
python -m app.main
```

#### Option 3: .env.local File
Create `backend/.env.local`:
```
DATABASE_URL=postgresql://user:password@localhost:5432/fleet
```

Then start:
```bash
cd backend
python -m app.main
```

## Database Initialization

### Automatic (Default)
Database tables are automatically created on first run.

### Manual Setup
```bash
cd backend
python setup_db.py
```

This will:
1. Read `DATABASE_URL` from environment or use default Neon URL
2. Connect to PostgreSQL
3. Create all required tables
4. Print connection details

## Verification

### Check Backend Health

```bash
curl http://localhost:5000/health
```

Expected response:
```json
{
  "status": "ok",
  "version": "1.0",
  "database": "connected",
  "timestamp": "2026-05-07T10:30:45Z"
}
```

### Check Database Connection

If the health check fails, verify:

1. **PostgreSQL is running**:
   ```bash
   psql -U user -h host -d database
   ```

2. **DATABASE_URL is correct**:
   ```bash
   # Windows: 
   echo $env:DATABASE_URL
   
   # macOS/Linux:
   echo $DATABASE_URL
   ```

3. **Network connectivity**:
   - For cloud databases (Neon, Supabase), check firewall rules
   - Ensure your IP is allowed
   - Check SSL requirements (sslmode=require)

## Error Messages

### "DATABASE_URL environment variable is required"
- No `DATABASE_URL` environment variable found
- **Solution**: Set DATABASE_URL or use default Neon database

### "DATABASE_URL must use a PostgreSQL scheme"
- URL doesn't start with `postgresql://` or `postgresql+psycopg://`
- **Solution**: Use PostgreSQL connection string

### "psycopg" import error
- psycopg library not installed
- **Solution**: `pip install -r requirements.txt`

### Connection refused / Host not found
- PostgreSQL server not running or unreachable
- **Solution**: Verify DATABASE_URL and PostgreSQL connection

## API Endpoints

All endpoints now require PostgreSQL:

- `GET /health` - Backend health check with DB status
- `GET /database/status` - Detailed database status
- `GET /vehicles` - List vehicles
- `POST /vehicles` - Create vehicle
- `PUT /vehicles/:id` - Update vehicle
- `DELETE /vehicles/:id` - Delete vehicle
- `GET /drivers` - List drivers
- `POST /drivers` - Create driver
- `GET /fuel-logs` - List fuel logs
- `POST /fuel-logs` - Create fuel log
- `GET /audit-logs` - List audit logs
- `POST /credit-score` - Calculate credit score

## Database Schema

All tables are created automatically. See [backend/app/models.py](backend/app/models.py) for:
- Vehicles
- Drivers
- Fuel Logs
- Audit Logs
- Lease Scorecards
- Driver Management Scorecards
- GPS Tracking Records
- Maintenance Records
- Insurance Records

## Production Deployment

For production, set `DATABASE_URL` to your production PostgreSQL instance:

```bash
# Before starting the backend in production:
export DATABASE_URL="postgresql://prod_user:prod_pass@prod_host:5432/fleet_prod"

# Use WSGI server instead of development server:
gunicorn -w 4 -b 0.0.0.0:5000 app.main:app
```

Ensure:
1. Database has SSL enabled (sslmode=require)
2. Credentials are stored securely (environment variables, secrets manager)
3. Backups are configured
4. Connection pooling is enabled for high traffic

## Rollback to SQLite (Not Recommended)

To temporarily use SQLite (not recommended for production), you would need to:
1. Restore old `models.py` and `main.py`
2. Restore SQLite database file
3. Remove PostgreSQL dependency

However, this is **not supported** in the current codebase.
