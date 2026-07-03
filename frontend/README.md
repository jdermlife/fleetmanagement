# Fleet Management System

Production-grade fleet management platform with enterprise security features.

## Features

- JWT authentication with PBKDF2 password hashing
- Role-based access control (RBAC) with granular permissions
- PostgreSQL database with connection pooling
- Audit logging for compliance
- Rate limiting protection
- Security headers (HSTS, CSP, X-Frame-Options)
- OpenAPI/Swagger documentation

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
5. Set environment variables:
   ```bash
   # Windows PowerShell:
   $env:DATABASE_URL = "postgresql://user:password@host:5432/database"
   $env:SECRET_KEY = "your-32-char-secret-key"
   
   # macOS/Linux:
   export DATABASE_URL="postgresql://user:password@host:5432/database"
   export SECRET_KEY="your-32-char-secret-key"
   ```
6. Initialize the database: `python setup_db.py`
7. Start the API: `python -m app.main`

The backend runs on `http://localhost:5000`.

### Frontend

1. Navigate to `frontend`
2. Install dependencies: `npm install`
3. Create a `.env.local` file:
   ```
   VITE_API_URL=http://localhost:5000
   VITE_PAYMENT_DEFAULT_CHANNEL=Bank Transfer
   VITE_PAYMENT_BANK_NAME=Your Bank Name
   VITE_PAYMENT_BANK_ACCOUNT_NAME=Your Business Name
   VITE_PAYMENT_BANK_ACCOUNT_NO=000000000000
   VITE_PAYMENT_GCASH_NUMBER=09XXXXXXXXX
   VITE_PAYMENT_GCASH_NAME=Your GCash Name
   VITE_PAYMENT_MAYA_NUMBER=09XXXXXXXXX
   VITE_PAYMENT_MAYA_NAME=Your Maya Name
   VITE_PAYMENT_SUPPORT_EMAIL=support@example.com
   VITE_GOOGLE_CLIENT_ID=your-google-oauth-web-client-id
   ```
4. Start the dev server: `npm run dev`

The frontend runs on `http://localhost:5173`.

### Mobile (Capacitor)

1. Build and sync web assets into native projects:
   ```bash
   npm run mobile:sync
   ```
2. Open Android project in Android Studio:
   ```bash
   npm run mobile:android
   ```
3. Open iOS project in Xcode (macOS required):
   ```bash
   npm run mobile:ios
   ```

Native project locations:
- Android: `frontend/android`
- iOS: `frontend/ios`

## Authentication

Protected endpoints require a JWT token in the Authorization header:

```bash
curl -H "Authorization: Bearer <token>" http://localhost:5000/vehicles
```

### Default Roles

- **Admin**: Full access to all resources
- **Manager**: Read/write vehicles, fuel logs, drivers, scorecards, audit logs
- **Driver**: Read-only access to vehicles and fuel logs
- **Viewer**: Read-only access to vehicles and fuel logs

## API Endpoints

### Authentication
- `POST /auth/login` - Authenticate user
- `POST /auth/logout` - Logout user
- `POST /auth/register` - Register new user
- `POST /auth/refresh` - Refresh JWT token

### Core API
- `GET /health` - Health check
- `GET /database/status` - Database connection status
- `GET /vehicles` - List vehicles
- `POST /vehicles` - Create vehicle
- `GET /fuel-logs` - List fuel logs
- `GET /audit-logs` - List audit trail
- `POST /credit-score` - Calculate credit score

## Verification

- Backend tests: `python -m unittest discover -s tests -v`
- Frontend lint: `npm run lint`
- Frontend build: `npm run build`

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| DATABASE_URL | PostgreSQL connection string | Required |
| SECRET_KEY | JWT signing key (32+ chars) | Auto-generated |
| TOKEN_EXPIRY_HOURS | JWT expiration time | 24 |
| RATE_LIMIT_REQUESTS | Max requests per window | 100 |
| RATE_LIMIT_WINDOW | Rate limit window (seconds) | 60 |
| VITE_PAYMENT_DEFAULT_CHANNEL | Default channel shown on the subscription payment page | Bank Transfer |
| VITE_PAYMENT_BANK_NAME | Bank name shown on the subscription payment page | Placeholder |
| VITE_PAYMENT_BANK_ACCOUNT_NAME | Bank account name shown on the subscription payment page | Placeholder |
| VITE_PAYMENT_BANK_ACCOUNT_NO | Bank account number shown on the subscription payment page | Placeholder |
| VITE_PAYMENT_GCASH_NUMBER | GCash number shown on the subscription payment page | Placeholder |
| VITE_PAYMENT_GCASH_NAME | GCash account name shown on the subscription payment page | Placeholder |
| VITE_PAYMENT_MAYA_NUMBER | Maya number shown on the subscription payment page | Placeholder |
| VITE_PAYMENT_MAYA_NAME | Maya account name shown on the subscription payment page | Placeholder |
| VITE_PAYMENT_SUPPORT_EMAIL | Support contact shown on the subscription payment page | Placeholder |

## Security Notes

- All passwords are hashed with PBKDF2 (100,000 iterations)
- JWT tokens expire after 24 hours by default
- Rate limiting: 100 requests per 60 seconds per IP
- Security headers applied to all responses
- Audit logging captures all data mutations