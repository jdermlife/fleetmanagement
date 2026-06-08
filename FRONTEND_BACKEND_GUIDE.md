# Frontend-Backend Connection Improvements

This document describes the enhancements made to improve the frontend-backend connection.

## What Was Improved

### 1. Enhanced API Configuration

**File**: `frontend/src/api.ts`

#### New Features:
- **Request/Response Interceptors**: All API calls are now logged to the console for debugging
- **Better Error Messages**: More descriptive error messages that help diagnose connection issues
- **Health Check Function**: `checkBackendHealth()` - validates backend availability
- **Timeout Configuration**: 10-second timeout for requests to catch hangs early
- **API URL Helper**: `getApiBaseUrl()` - returns the configured backend URL

#### Usage:
```typescript
import { api, checkBackendHealth, getErrorMessage, getApiBaseUrl } from './api'

// Check if backend is healthy
const isHealthy = await checkBackendHealth()

// Get the configured API URL
console.log(getApiBaseUrl()) // http://localhost:5000

// Make API calls (all logged automatically)
const vehicles = await api.get('/vehicles')

// Better error handling
try {
  await api.post('/vehicles', data)
} catch (error) {
  const message = getErrorMessage(error, 'Failed to create vehicle')
  console.error(message)
}
```

### 2. Environment Configuration

**Files**: 
- `frontend/.env.example` - Example configuration
- `frontend/.env.local` - Development configuration (created automatically)
- `backend/.env.example` - Backend configuration reference

#### Configuration:
```env
# Frontend (.env.local)
VITE_API_URL=http://localhost:5000

# Backend (.env.local) - optional
DATABASE_URL=postgresql://user:password@localhost:5432/database
FLASK_DEBUG=1
```

### 3. Enhanced Backend CORS Configuration

**File**: `backend/app/main.py`

The backend now explicitly allows CORS requests from:
- `http://localhost:5173` (Vite default)
- `http://localhost:3000` (React dev server)
- `http://localhost:5000` (same server)

Allowed methods: GET, POST, PUT, DELETE, OPTIONS

### 4. Improved Health Check Endpoint

**Endpoint**: `GET /health`

**Response**:
```json
{
  "status": "ok",
  "version": "1.0",
  "database": "connected",
  "timestamp": "2024-05-06T10:30:45.123456Z"
}
```

Includes:
- Status indicator
- Version info
- Database connection status
- Server timestamp

### 5. Connection Status Component

**File**: `frontend/src/components/BackendConnectionStatus.tsx`

A React component that displays backend connection status. Can be added to your app to show users if the backend is available.

#### Usage:
```typescript
import BackendConnectionStatus from './components/BackendConnectionStatus'

export default function App() {
  return (
    <div>
      <BackendConnectionStatus />
      {/* Rest of your app */}
    </div>
  )
}
```

## Running the Application

### Step 1: Start the Backend

```bash
cd backend

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies (first time only)
pip install -r requirements.txt

# Start the server
python -m app.main
```

You should see:
```
 * Running on http://127.0.0.1:5000
```

### Step 2: Start the Frontend (in a new terminal)

```bash
cd frontend

# Install dependencies (first time only)
npm install

# Start the dev server
npm run dev
```

You should see:
```
VITE v5.0.8  ready in 123 ms

➜  Local:   http://localhost:5173/
```

### Step 3: Verify Connection

1. Open `http://localhost:5173` in your browser
2. Open DevTools (F12) and check the Console tab
3. You should see API calls being logged:
   ```
   [API] GET /vehicles
   [API] Response: 200 OK
   ```

## Troubleshooting

### Problem: "Cannot reach backend"

**Solution**: Check if backend is running
```bash
curl http://localhost:5000/health
```

Should return:
```json
{"status": "ok", "database": "connected", ...}
```

### Problem: CORS Errors in Console

**Solution**: Check that you're accessing from an allowed origin:
- Frontend must be at `http://localhost:5173` (not `127.0.0.1:5173`)
- Backend must be at `http://localhost:5000`

### Problem: "Connection Refused" or "Network Error"

**Solution**: 
1. Ensure backend is actually running on port 5000
2. Check if port 5000 is blocked by firewall
3. Try: `ping localhost` to verify network connectivity
4. Check browser console (DevTools) for detailed error

### Problem: Database Connection Errors

**Solution**: Check backend logs for database errors:
```bash
# Check SQLite connection (default)
ls -la backend/app/fleet_mgmt_db.db

# Or use PostgreSQL if configured
# Verify DATABASE_URL environment variable
echo $DATABASE_URL
```

## Browser Console Debugging

The frontend logs all API activity. Open DevTools (F12) and filter by `[API]`:

```
[API] GET /vehicles
[API] Response: 200 OK
[API] POST /drivers
[API] Response: 201 Created
[API] Response error: {status: 500, data: {...}}
```

## Adding to Your Pages

To use the API in a React component:

```typescript
import { api, getErrorMessage } from '../api'

export default function MyComponent() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchData = async () => {
    setLoading(true)
    try {
      const response = await api.get('/vehicles')
      setData(response.data)
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to fetch data'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {error && <div className="error">{error}</div>}
      {loading && <div>Loading...</div>}
      {data && <div>{JSON.stringify(data)}</div>}
      <button onClick={fetchData}>Load Data</button>
    </div>
  )
}
```

## Next Steps

1. Add the `BackendConnectionStatus` component to your main App
2. Test each API endpoint by visiting pages and checking console logs
3. Update `.env.local` if your backend is on a different URL
4. For production, build the frontend with `npm run build`
5. Serve the built frontend from the backend or a separate server

## API Endpoints Reference

- `GET /health` - Backend health check
- `GET /database/status` - Database status
- `GET /vehicles` - List all vehicles
- `POST /vehicles` - Create vehicle
- `PUT /vehicles/:id` - Update vehicle
- `DELETE /vehicles/:id` - Delete vehicle
- `GET /drivers` - List all drivers
- `POST /drivers` - Create driver
- `GET /fuel-logs` - List fuel logs
- `POST /fuel-logs` - Create fuel log
- `GET /audit-logs` - List audit logs
- `POST /credit-score` - Calculate credit score
