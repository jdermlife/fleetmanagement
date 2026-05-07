#!/usr/bin/env python3
#!/usr/bin/env python3
"""
Database setup script for the Fleet Management System.

This script initializes the PostgreSQL database using the DATABASE_URL environment variable.
PostgreSQL (Neon) is the only supported database engine.
"""

import os
from urllib.parse import urlparse
from app.models import init_db, resolve_database_config

def main():
    # Neon PostgreSQL connection string (REQUIRED)
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError(
            "DATABASE_URL environment variable is required. "
            "Get your Neon connection string from https://console.neon.tech"
        )

    # Resolve database configuration
    config = resolve_database_config(database_url, None)

    # Initialize the database
    init_db(config)

    print("Database initialized successfully.")
    print(f"Database engine: {config.engine}")
    if config.engine == "postgresql":
        parsed = urlparse(database_url)
        print(f"Database host: {parsed.hostname}")
        print(f"Database port: {parsed.port or 5432}")
        print(f"Database name: {parsed.path.lstrip('/')}")
        print(f"Connection: {database_url}")
    else:
        raise RuntimeError("Only PostgreSQL is supported. SQLite fallback is disabled.")

if __name__ == "__main__":
    main()
