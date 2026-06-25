"""Enable and configure RLS policies for users and subscriptions tables."""

from sqlalchemy import text

from app.database import engine


STATEMENTS = [
    "ALTER TABLE users ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY",
    "ALTER TABLE users FORCE ROW LEVEL SECURITY",
    "ALTER TABLE subscriptions FORCE ROW LEVEL SECURITY",
    "DROP POLICY IF EXISTS users_admin_all_policy ON users",
    "DROP POLICY IF EXISTS users_owner_select_policy ON users",
    "DROP POLICY IF EXISTS users_owner_update_policy ON users",
    "DROP POLICY IF EXISTS users_owner_insert_policy ON users",
    "DROP POLICY IF EXISTS subscriptions_admin_all_policy ON subscriptions",
    "DROP POLICY IF EXISTS subscriptions_owner_select_policy ON subscriptions",
    "DROP POLICY IF EXISTS subscriptions_owner_insert_policy ON subscriptions",
    "DROP POLICY IF EXISTS subscriptions_owner_update_policy ON subscriptions",
    "DROP POLICY IF EXISTS subscriptions_owner_delete_policy ON subscriptions",
    """
    CREATE POLICY users_admin_all_policy ON users
    FOR ALL
    USING (current_setting('app.user_role', true) = 'admin')
    WITH CHECK (current_setting('app.user_role', true) = 'admin');
    """,
    """
    CREATE POLICY users_owner_select_policy ON users
    FOR SELECT
    USING (
      current_setting('app.user_role', true) <> 'admin'
      AND id = NULLIF(current_setting('app.user_id', true), '')::INTEGER
      AND COALESCE(is_deleted, FALSE) = FALSE
    );
    """,
    """
    CREATE POLICY users_owner_update_policy ON users
    FOR UPDATE
    USING (
      current_setting('app.user_role', true) <> 'admin'
      AND id = NULLIF(current_setting('app.user_id', true), '')::INTEGER
      AND COALESCE(is_deleted, FALSE) = FALSE
    )
    WITH CHECK (
      current_setting('app.user_role', true) <> 'admin'
      AND id = NULLIF(current_setting('app.user_id', true), '')::INTEGER
      AND COALESCE(is_deleted, FALSE) = FALSE
    );
    """,
    """
    CREATE POLICY users_owner_insert_policy ON users
    FOR INSERT
    WITH CHECK (
      current_setting('app.user_role', true) = 'admin'
      OR id = NULLIF(current_setting('app.user_id', true), '')::INTEGER
    );
    """,
    """
    CREATE POLICY subscriptions_admin_all_policy ON subscriptions
    FOR ALL
    USING (current_setting('app.user_role', true) = 'admin')
    WITH CHECK (current_setting('app.user_role', true) = 'admin');
    """,
    """
    CREATE POLICY subscriptions_owner_select_policy ON subscriptions
    FOR SELECT
    USING (
      current_setting('app.user_role', true) <> 'admin'
      AND user_id = NULLIF(current_setting('app.user_id', true), '')::INTEGER
    );
    """,
    """
    CREATE POLICY subscriptions_owner_insert_policy ON subscriptions
    FOR INSERT
    WITH CHECK (
      current_setting('app.user_role', true) <> 'admin'
      AND user_id = NULLIF(current_setting('app.user_id', true), '')::INTEGER
    );
    """,
    """
    CREATE POLICY subscriptions_owner_update_policy ON subscriptions
    FOR UPDATE
    USING (
      current_setting('app.user_role', true) <> 'admin'
      AND user_id = NULLIF(current_setting('app.user_id', true), '')::INTEGER
    )
    WITH CHECK (
      current_setting('app.user_role', true) <> 'admin'
      AND user_id = NULLIF(current_setting('app.user_id', true), '')::INTEGER
    );
    """,
    """
    CREATE POLICY subscriptions_owner_delete_policy ON subscriptions
    FOR DELETE
    USING (
      current_setting('app.user_role', true) <> 'admin'
      AND user_id = NULLIF(current_setting('app.user_id', true), '')::INTEGER
    );
    """,
]


def run_migration() -> None:
    with engine.begin() as connection:
        for statement in STATEMENTS:
            connection.execute(text(statement))


if __name__ == "__main__":
    run_migration()
    print("RLS policies migration completed.")
