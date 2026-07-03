from sqlalchemy import BigInteger, Boolean, CheckConstraint, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base
from app.models.roles import role_permissions, user_roles


class User(Base):
	__tablename__ = "users"
	__table_args__ = (
		CheckConstraint(
			"account_status IN ('ACTIVE','PENDING','LOCKED','SUSPENDED','DISABLED','DELETED')",
			name="chk_account_status",
		),
	)

	id = Column(Integer, primary_key=True)
	username = Column(String(100), nullable=False, unique=True, index=True)
	email = Column(String(255), nullable=False, unique=True, index=True)
	password_hash = Column(Text, nullable=False)
	role = Column(String(100), nullable=False, default="viewer")
	role_id = Column(Integer, ForeignKey("roles.id"), index=True)
	subscription_id = Column(BigInteger, ForeignKey("subscriptions.id"), index=True)
	tenant_id = Column(BigInteger, index=True)
	created_by = Column(Integer, ForeignKey("users.id"), index=True)
	updated_by = Column(Integer, ForeignKey("users.id"), index=True)
	deleted_by = Column(Integer, ForeignKey("users.id"), index=True)
	is_active = Column(Boolean, nullable=False, default=True)
	is_deleted = Column(Boolean, nullable=False, default=False)
	deleted_at = Column(DateTime(timezone=True))
	account_status = Column(String(30), nullable=False, default="ACTIVE")
	first_name = Column(String(100))
	middle_name = Column(String(100))
	last_name = Column(String(100))
	mobile_no = Column(String(30))
	profile_photo = Column(Text)
	total_login_count = Column(Integer, nullable=False, default=0)
	last_failed_login = Column(DateTime(timezone=True))
	last_login_ip = Column(String(100))
	last_login_device = Column(Text)
	api_access = Column(Boolean, nullable=False, default=False)
	email_verified = Column(Boolean, nullable=False, default=False)
	email_verified_at = Column(DateTime(timezone=True))
	password_changed_at = Column(DateTime(timezone=True))
	password_reset_expires = Column(DateTime(timezone=True))
	password_expires_at = Column(DateTime(timezone=True))
	force_password_change = Column(Boolean, nullable=False, default=False)
	lender_data_sharing_consent = Column(Boolean, nullable=False, default=False)
	lender_data_sharing_consent_recorded_at = Column(DateTime(timezone=True))

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
	role_ref = relationship("Role", foreign_keys=[role_id], lazy="selectin")
	subscription = relationship("Subscription", foreign_keys=[subscription_id], lazy="selectin")
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
