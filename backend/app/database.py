from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv
import os

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL") or "sqlite:///./fleet.db"

engine_kwargs = {
    "pool_pre_ping": True,
}

if DATABASE_URL.startswith("postgresql"):
    engine_kwargs.update({
        "pool_recycle": 300,
        "pool_size": 5,
        "max_overflow": 10,
        "connect_args": {"sslmode": "require"},
    })
elif DATABASE_URL.startswith("sqlite"):
    engine_kwargs.update({
        "connect_args": {"check_same_thread": False},
    })

engine = create_engine(DATABASE_URL, **engine_kwargs)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def set_rls_context(db, user_id: int | None, user_role: str | None) -> None:
    if not DATABASE_URL.startswith("postgresql"):
        return

    if not hasattr(db, "execute"):
        return

    uid = "" if user_id is None else str(user_id)
    role = "" if user_role is None else user_role.lower()
    db.execute(text("SELECT set_config('app.user_id', :uid, true)"), {"uid": uid})
    db.execute(text("SELECT set_config('app.user_role', :role, true)"), {"role": role})
