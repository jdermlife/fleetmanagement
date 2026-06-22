from sqlalchemy.orm import Session

from app.models.roles import Permission, Role, role_permissions
from security.rbac import Permission as RBACPermission
from security.rbac import ROLE_PERMISSIONS, Role as RBACRole


def _split_permission_name(name: str) -> tuple[str, str]:
    if ":" in name:
        action, resource = name.split(":", 1)
        return resource, action
    if "_" in name:
        action, resource = name.split("_", 1)
        return resource, action
    return "general", name


def seed_roles_and_permissions(db: Session) -> None:
    existing_permissions = {
        permission.name: permission
        for permission in db.query(Permission).all()
    }

    for perm in RBACPermission:
        if perm.value in existing_permissions:
            continue
        resource, action = _split_permission_name(perm.value)
        db.add(
            Permission(
                name=perm.value,
                description=f"Auto-seeded permission {perm.value}",
                resource=resource,
                action=action,
            )
        )
    db.flush()

    permission_lookup = {
        permission.name: permission
        for permission in db.query(Permission).all()
    }

    role_lookup = {
        role.name: role
        for role in db.query(Role).all()
    }

    for rbac_role in RBACRole:
        role_name = rbac_role.value
        if role_name not in role_lookup:
            role = Role(name=role_name, description=f"Auto-seeded role {role_name}", is_system=True)
            db.add(role)
            db.flush()
            role_lookup[role_name] = role

    db.execute(role_permissions.delete())

    for rbac_role, permissions in ROLE_PERMISSIONS.items():
        role = role_lookup[rbac_role.value]
        for perm in permissions:
            db.execute(
                role_permissions.insert().values(
                    role_id=role.id,
                    permission_id=permission_lookup[perm.value].id,
                )
            )

    db.commit()
