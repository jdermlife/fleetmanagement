from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Table, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


user_roles = Table(
	"user_roles",
	Base.metadata,
	Column("user_id", ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
	Column("role_id", ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
)


role_permissions = Table(
	"role_permissions",
	Base.metadata,
	Column("role_id", ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
	Column("permission_id", ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True),
)


class Role(Base):
	__tablename__ = "roles"

	id = Column(Integer, primary_key=True)
	name = Column(String(100), nullable=False, unique=True, index=True)
	description = Column(Text)
	is_system = Column(Boolean, nullable=False, default=True)
	created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

	users = relationship("User", secondary=user_roles, back_populates="roles", lazy="selectin")
	permissions = relationship(
		"Permission",
		secondary=role_permissions,
		back_populates="roles",
		lazy="selectin",
	)


class Permission(Base):
	__tablename__ = "permissions"

	id = Column(Integer, primary_key=True)
	name = Column(String(150), nullable=False, unique=True, index=True)
	description = Column(Text)
	resource = Column(String(100), nullable=False, index=True)
	action = Column(String(100), nullable=False, index=True)
	created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

	roles = relationship("Role", secondary=role_permissions, back_populates="permissions", lazy="selectin")
