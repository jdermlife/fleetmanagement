#!/usr/bin/env python3
"""
Database setup script for the Fleet Management System.

This script initializes the database by creating all necessary tables
if they do not already exist.
"""

from pathlib import Path
from app.models import init_db, resolve_database_config

def main():
    # Determine the database path
    base_dir = Path(__file__).resolve().parent
    default_database_path = base_dir / "app" / "fms.db"

    # Resolve database configuration
    config = resolve_database_config(None, default_database_path)

    # Initialize the database
    init_db(config)

    print("Database initialized successfully.")
    print(f"Database path: {config.path}")

if __name__ == "__main__":
    main()