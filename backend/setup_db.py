#!/usr/bin/env python3
"""
Database setup script for the Fleet Management System.

This script initializes the database (fleet_mgmt_db) by creating all necessary 
tables/nodes if they do not already exist. Supports SQLite, PostgreSQL, and Neo4j.
"""

from pathlib import Path
from app.models import init_db, resolve_database_config

def main():
    # Determine the database path for SQLite fallback
    base_dir = Path(__file__).resolve().parent
    default_database_path = base_dir / "app" / "fleet_mgmt_db.db"

    # Resolve database configuration
    config = resolve_database_config(None, default_database_path)

    # Initialize the database
    init_db(config)

    print("Database 'fleet_mgmt_db' initialized successfully.")
    print(f"Database engine: {config.engine}")
    if config.engine == "sqlite":
        print(f"Database path: {config.path}")
    else:
        print(f"Database host: {config.host}")
        print(f"Database name: {config.name}")

if __name__ == "__main__":
    main()