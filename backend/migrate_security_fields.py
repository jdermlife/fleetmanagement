"""
Migration helper to add enterprise security fields to users table.
Run this once to prepare the database for account lockout and password reset features.
"""

import sys
from contextlib import closing

try:
    from app.models import get_connection
except ImportError:
    from backend.app.models import get_connection


def add_security_fields_to_users():
    """Add account lockout and password reset fields to users table."""
    
    # Get database connection (uses DATABASE_URL environment variable)
    import os
    config = {
        "DATABASE_URL": os.getenv("DATABASE_URL"),
    }
    
    with closing(get_connection(config)) as connection:
        try:
            # Check if columns already exist by attempting to read them
            cursor = connection.execute(
                "SELECT failed_login_attempts, locked_until, password_reset_token, password_reset_token_expires FROM users LIMIT 1"
            )
            print("✓ Security fields already exist in users table")
            return True
        except Exception:
            pass
        
        # Add the columns
        print("Adding security fields to users table...")
        
        try:
            # SQLite doesn't support multiple ALTER TABLE in one statement
            connection.execute("ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0")
            print("  ✓ Added failed_login_attempts column")
        except Exception as e:
            if "already exists" not in str(e):
                print(f"  ! Error adding failed_login_attempts: {e}")
        
        try:
            connection.execute("ALTER TABLE users ADD COLUMN locked_until TEXT")
            print("  ✓ Added locked_until column")
        except Exception as e:
            if "already exists" not in str(e):
                print(f"  ! Error adding locked_until: {e}")
        
        try:
            connection.execute("ALTER TABLE users ADD COLUMN password_reset_token TEXT")
            print("  ✓ Added password_reset_token column")
        except Exception as e:
            if "already exists" not in str(e):
                print(f"  ! Error adding password_reset_token: {e}")
        
        try:
            connection.execute("ALTER TABLE users ADD COLUMN password_reset_token_expires TEXT")
            print("  ✓ Added password_reset_token_expires column")
        except Exception as e:
            if "already exists" not in str(e):
                print(f"  ! Error adding password_reset_token_expires: {e}")
        
        connection.commit()
        print("✓ Migration complete")
        return True


if __name__ == "__main__":
    try:
        add_security_fields_to_users()
        print("\n✓ Database ready for enterprise security features")
        sys.exit(0)
    except Exception as e:
        print(f"\n✗ Migration failed: {e}", file=sys.stderr)
        sys.exit(1)
