from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base
from app.models.roles import role_permissions, user_roles


class User(Base):
	__tablename__ = "users"

	id = Column(Integer, primary_key=True)
	username = Column(String(150), nullable=False, unique=True, index=True)
	email = Column(String(255), nullable=False, unique=True, index=True)
	password_hash = Column(Text, nullable=False)
	role = Column(String(100), nullable=False, default="viewer")
	is_active = Column(Boolean, nullable=False, default=True)

	last_login_at = Column(DateTime(timezone=True))
	failed_login_attempts = Column(Integer, nullable=False, default=0)
	locked_until = Column(DateTime(timezone=True))
	password_reset_token = Column(Text)
	password_reset_token_expires = Column(DateTime(timezone=True))

	mfa_enabled = Column(Boolean, nullable=False, default=False)
	mfa_secret = Column(Text)

	created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
	updated_at = Column(DateTime(timezone=True), onupdate=func.now())

	roles = relationship("Role", secondary=user_roles, back_populates="users", lazy="selectin")
	sessions = relationship("AuthSession", back_populates="user", cascade="all, delete-orphan")
	mfa_backup_codes = relationship(
		"MfaBackupCode",
		back_populates="user",
		cascade="all, delete-orphan",
	)


class AuthSession(Base):
	__tablename__ = "auth_sessions"

	id = Column(Integer, primary_key=True)
	user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
	refresh_token_hash = Column(Text, nullable=False, unique=True)
	jti = Column(String(64), nullable=False, unique=True, index=True)
	ip_address = Column(String(100))
	user_agent = Column(Text)
	expires_at = Column(DateTime(timezone=True), nullable=False)
	revoked_at = Column(DateTime(timezone=True))
	last_seen_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
	created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

	user = relationship("User", back_populates="sessions")


class MfaBackupCode(Base):
	__tablename__ = "mfa_backup_codes"

	id = Column(Integer, primary_key=True)
	user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
	code_hash = Column(String(128), nullable=False, unique=True)
	used_at = Column(DateTime(timezone=True))
	created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

	user = relationship("User", back_populates="mfa_backup_codes")
