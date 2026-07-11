from enum import Enum
from typing import Iterable


class Permission(str, Enum):
    VIEW_DASHBOARD = "view_dashboard"
    VIEW_TASKS = "view_tasks"
    VIEW_GROCERIES = "view_groceries"
    VIEW_MEALS = "view_meals"
    VIEW_FAMILY = "view_family"
    VIEW_ANALYTICS = "view_analytics"
    USE_ASSISTANT = "use_assistant"
    VIEW_IMPLEMENTATION = "view_implementation"
    VIEW_AUDIT = "view_audit"
    VIEW_CACHE_STATS = "view_cache_stats"
    MANAGE_TASKS = "manage_tasks"
    MANAGE_GROCERIES = "manage_groceries"
    MANAGE_GROCERY_TYPES = "manage_grocery_types"
    MANAGE_MEALS = "manage_meals"
    MANAGE_RECIPES = "manage_recipes"
    MANAGE_FAMILY = "manage_family"
    MANAGE_ANNOUNCEMENTS = "manage_announcements"
    MANAGE_CONTACTS = "manage_contacts"
    MARK_NOTIFICATIONS = "mark_notifications"


BASE_READ_PERMISSIONS: frozenset[str] = frozenset(
    permission.value
    for permission in (
        Permission.VIEW_DASHBOARD,
        Permission.VIEW_TASKS,
        Permission.VIEW_GROCERIES,
        Permission.VIEW_MEALS,
        Permission.VIEW_FAMILY,
        Permission.VIEW_ANALYTICS,
        Permission.USE_ASSISTANT,
        Permission.MARK_NOTIFICATIONS,
    )
)

PARENT_PERMISSIONS: frozenset[str] = frozenset(permission.value for permission in Permission)

ROLE_DEFAULT_PERMISSIONS: dict[str, frozenset[str]] = {
    "admin": PARENT_PERMISSIONS,
    "parent": PARENT_PERMISSIONS,
    "mom": PARENT_PERMISSIONS,
    "dad": PARENT_PERMISSIONS,
    "guardian": PARENT_PERMISSIONS,
    "member": BASE_READ_PERMISSIONS,
    "child": BASE_READ_PERMISSIONS,
}


def normalize_permission(value: str) -> str | None:
    normalized = value.strip().lower()
    allowed = {permission.value for permission in Permission}
    return normalized if normalized in allowed else None


def role_default_permissions(role: str | None) -> frozenset[str]:
    return ROLE_DEFAULT_PERMISSIONS.get((role or "").strip().lower(), BASE_READ_PERMISSIONS)


def effective_permissions(role: str | None, explicit_permissions: Iterable[str] | None = None) -> frozenset[str]:
    permissions = set(role_default_permissions(role))
    for permission in explicit_permissions or []:
        normalized = normalize_permission(str(permission))
        if normalized:
            permissions.add(normalized)
    return frozenset(permissions)
