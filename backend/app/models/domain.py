import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import JSON, Boolean, Date, DateTime, ForeignKey, Index, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def uuid_string() -> str:
    return str(uuid.uuid4())


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)


class ActiveMixin:
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class User(Base, TimestampMixin, ActiveMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    uuid: Mapped[str] = mapped_column(String(36), default=uuid_string, unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(255))
    family_role: Mapped[str | None] = mapped_column(String(50))
    token_version: Mapped[int] = mapped_column(default=0, nullable=False)
    max_devices: Mapped[int] = mapped_column(default=5, nullable=False)

    family_memberships: Mapped[list["FamilyMember"]] = relationship(back_populates="user")
    devices: Mapped[list["Device"]] = relationship(back_populates="user")


class Device(Base, TimestampMixin, ActiveMixin):
    __tablename__ = "devices"
    __table_args__ = (
        Index("idx_devices_user_device", "user_id", "device_id", unique=True),
        Index("idx_devices_user_id", "user_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    uuid: Mapped[str] = mapped_column(String(36), default=uuid_string, unique=True, nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    family_id: Mapped[int | None] = mapped_column(ForeignKey("families.id", ondelete="SET NULL"), index=True)
    device_id: Mapped[str] = mapped_column(String(100), nullable=False)
    device_name: Mapped[str | None] = mapped_column(String(255))
    device_type: Mapped[str] = mapped_column(String(30), default="browser", nullable=False)
    platform: Mapped[str | None] = mapped_column(String(100))
    user_agent: Mapped[str | None] = mapped_column(String(512))
    ip_address: Mapped[str | None] = mapped_column(String(45))
    last_ip: Mapped[str | None] = mapped_column(String(45))
    last_user_agent: Mapped[str | None] = mapped_column(String(512))
    is_revoked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_trusted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    registered_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    last_used_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    user: Mapped["User"] = relationship(back_populates="devices")
    sessions: Mapped[list["DeviceSession"]] = relationship(back_populates="device", cascade="all, delete-orphan")


class DeviceSession(Base):
    __tablename__ = "device_sessions"
    __table_args__ = (
        Index("idx_device_sessions_device", "device_id"),
        Index("idx_device_sessions_jti", "jti", unique=True),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    uuid: Mapped[str] = mapped_column(String(36), default=uuid_string, unique=True, nullable=False)
    device_id: Mapped[int] = mapped_column(ForeignKey("devices.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    family_id: Mapped[int | None] = mapped_column(ForeignKey("families.id", ondelete="SET NULL"))
    jti: Mapped[str] = mapped_column(String(36), nullable=False)
    token_type: Mapped[str] = mapped_column(String(10), nullable=False)  # access | refresh
    issued_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime)
    ip_address: Mapped[str | None] = mapped_column(String(45))
    user_agent: Mapped[str | None] = mapped_column(String(512))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    device: Mapped["Device"] = relationship(back_populates="sessions")


class Family(Base, TimestampMixin, ActiveMixin):
    __tablename__ = "families"

    id: Mapped[int] = mapped_column(primary_key=True)
    uuid: Mapped[str] = mapped_column(String(36), default=uuid_string, unique=True, nullable=False)
    family_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    home_base: Mapped[str] = mapped_column(String(255), default="Singapore", nullable=False)
    timezone: Mapped[str] = mapped_column(String(64), default="Asia/Singapore", nullable=False)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))

    members: Mapped[list["FamilyMember"]] = relationship(back_populates="family", cascade="all, delete-orphan")
    grocery_list_types: Mapped[list["GroceryListType"]] = relationship(back_populates="family")
    grocery_items: Mapped[list["GroceryItem"]] = relationship(back_populates="family")
    tasks: Mapped[list["Task"]] = relationship(back_populates="family")
    meal_plans: Mapped[list["MealPlan"]] = relationship(back_populates="family")
    notifications: Mapped[list["Notification"]] = relationship(back_populates="family")


class FamilyMember(Base):
    __tablename__ = "family_members"
    __table_args__ = (UniqueConstraint("family_id", "user_id", name="unique_family_user"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    family_id: Mapped[int] = mapped_column(ForeignKey("families.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="member", nullable=False)
    initial: Mapped[str] = mapped_column(String(4), default="?", nullable=False)
    color_class: Mapped[str] = mapped_column(String(64), default="bg-slate-500", nullable=False)
    status: Mapped[str] = mapped_column(String(255), default="Active", nullable=False)
    points: Mapped[int] = mapped_column(default=0, nullable=False)
    dietary_notes: Mapped[list[str] | None] = mapped_column(JSON)
    permissions: Mapped[list[str] | None] = mapped_column(JSON)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    joined_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    family: Mapped["Family"] = relationship(back_populates="members")
    user: Mapped["User"] = relationship(back_populates="family_memberships")


class FamilyInvite(Base, TimestampMixin, ActiveMixin):
    __tablename__ = "family_invites"
    __table_args__ = (
        Index("idx_family_invites_token_hash", "token_hash", unique=True),
        Index("idx_family_invites_family", "family_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    uuid: Mapped[str] = mapped_column(String(36), default=uuid_string, unique=True, nullable=False)
    family_id: Mapped[int] = mapped_column(ForeignKey("families.id", ondelete="CASCADE"), nullable=False)
    invited_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(50), default="member", nullable=False)
    permissions: Mapped[list[str] | None] = mapped_column(JSON)
    max_uses: Mapped[int] = mapped_column(default=1, nullable=False)
    used_count: Mapped[int] = mapped_column(default=0, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime)


class GroceryType(Base):
    __tablename__ = "grocery_types"

    id: Mapped[int] = mapped_column(primary_key=True)
    type_name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    icon: Mapped[str | None] = mapped_column(String(50))
    color: Mapped[str | None] = mapped_column(String(20))
    is_system: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)


class FrequencyType(Base):
    __tablename__ = "frequency_types"

    id: Mapped[int] = mapped_column(primary_key=True)
    frequency_name: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    days_interval: Mapped[int] = mapped_column(nullable=False)
    display_order: Mapped[int | None] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)


class GroceryListType(Base, TimestampMixin, ActiveMixin):
    __tablename__ = "grocery_list_types"
    __table_args__ = (UniqueConstraint("list_name", "family_id", name="unique_list_per_family"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    uuid: Mapped[str] = mapped_column(String(36), default=uuid_string, unique=True, nullable=False)
    list_name: Mapped[str] = mapped_column(String(100), nullable=False)
    list_type: Mapped[str] = mapped_column(String(50), default="standard", nullable=False)
    description: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    color_class: Mapped[str] = mapped_column(String(64), default="bg-blue-500", nullable=False)
    family_id: Mapped[int] = mapped_column(ForeignKey("families.id", ondelete="CASCADE"), nullable=False, index=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    is_template: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    family: Mapped["Family"] = relationship(back_populates="grocery_list_types")
    items: Mapped[list["GroceryItem"]] = relationship(back_populates="list_type")
    cycles: Mapped[list["GroceryPurchaseCycle"]] = relationship(back_populates="list_type")


class GroceryItem(Base, TimestampMixin, ActiveMixin):
    __tablename__ = "grocery_items"
    __table_args__ = (
        UniqueConstraint("item_name", "list_type_id", name="unique_item_per_list"),
        Index("idx_grocery_items_frequency", "purchase_frequency"),
        Index("idx_grocery_items_stock", "current_stock"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    uuid: Mapped[str] = mapped_column(String(36), default=uuid_string, unique=True, nullable=False)
    item_number: Mapped[str] = mapped_column(String(20), nullable=False)
    item_name: Mapped[str] = mapped_column(String(255), nullable=False)
    list_type_id: Mapped[int] = mapped_column(ForeignKey("grocery_list_types.id", ondelete="CASCADE"), nullable=False, index=True)
    quantity: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    unit: Mapped[str | None] = mapped_column(String(20))
    purchase_frequency: Mapped[str] = mapped_column(String(20), default="weekly", nullable=False, index=True)
    current_stock: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    expiry_date: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)
    family_id: Mapped[int] = mapped_column(ForeignKey("families.id", ondelete="CASCADE"), nullable=False, index=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))

    family: Mapped["Family"] = relationship(back_populates="grocery_items")
    list_type: Mapped["GroceryListType"] = relationship(back_populates="items")
    sub_list_items: Mapped[list["GrocerySubList"]] = relationship(back_populates="item", cascade="all, delete-orphan")


class GroceryPurchaseCycle(Base, TimestampMixin):
    __tablename__ = "grocery_purchase_cycles"
    __table_args__ = (
        UniqueConstraint("list_type_id", "frequency", "cycle_start_date", name="unique_cycle"),
        Index("idx_cycle_dates", "cycle_start_date", "cycle_end_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    uuid: Mapped[str] = mapped_column(String(36), default=uuid_string, unique=True, nullable=False)
    list_type_id: Mapped[int] = mapped_column(ForeignKey("grocery_list_types.id", ondelete="CASCADE"), nullable=False)
    frequency: Mapped[str] = mapped_column(String(20), nullable=False)
    cycle_start_date: Mapped[date] = mapped_column(Date, nullable=False)
    cycle_end_date: Mapped[date] = mapped_column(Date, nullable=False)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    family_id: Mapped[int] = mapped_column(ForeignKey("families.id", ondelete="CASCADE"), nullable=False, index=True)

    list_type: Mapped["GroceryListType"] = relationship(back_populates="cycles")
    sub_list_items: Mapped[list["GrocerySubList"]] = relationship(back_populates="purchase_cycle", cascade="all, delete-orphan")


class GrocerySubList(Base, TimestampMixin):
    __tablename__ = "grocery_sub_lists"
    __table_args__ = (
        UniqueConstraint("purchase_cycle_id", "item_id", name="unique_sub_list_item"),
        Index("idx_sublist_purchased", "is_purchased"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    uuid: Mapped[str] = mapped_column(String(36), default=uuid_string, unique=True, nullable=False)
    purchase_cycle_id: Mapped[int] = mapped_column(ForeignKey("grocery_purchase_cycles.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("grocery_items.id", ondelete="CASCADE"), nullable=False)
    quantity: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    unit: Mapped[str | None] = mapped_column(String(20))
    is_purchased: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    purchased_quantity: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), default=0)
    notes: Mapped[str | None] = mapped_column(Text)
    is_adhoc: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    carried_forward: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    purchase_cycle: Mapped["GroceryPurchaseCycle"] = relationship(back_populates="sub_list_items")
    item: Mapped["GroceryItem"] = relationship(back_populates="sub_list_items")


class Task(Base, TimestampMixin, ActiveMixin):
    __tablename__ = "tasks"
    __table_args__ = (
        Index("idx_tasks_due_date_status", "due_date", "status"),
        Index("idx_tasks_assigned", "assigned_to"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    uuid: Mapped[str] = mapped_column(String(36), default=uuid_string, unique=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    priority: Mapped[str] = mapped_column(String(20), default="medium", nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False, index=True)
    due_date: Mapped[datetime | None] = mapped_column(DateTime, index=True)
    reminder_date: Mapped[datetime | None] = mapped_column(DateTime)
    recurrence_type: Mapped[str] = mapped_column(String(20), default="none", nullable=False)
    recurrence_interval: Mapped[int] = mapped_column(default=1, nullable=False)
    recurrence_end_date: Mapped[datetime | None] = mapped_column(DateTime)
    family_id: Mapped[int] = mapped_column(ForeignKey("families.id", ondelete="CASCADE"), nullable=False, index=True)
    assigned_to: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    category: Mapped[str | None] = mapped_column(String(100))
    action_label: Mapped[str | None] = mapped_column(String(100))

    family: Mapped["Family"] = relationship(back_populates="tasks")


class MealPlan(Base, TimestampMixin, ActiveMixin):
    __tablename__ = "meal_plans"
    __table_args__ = (
        UniqueConstraint("family_id", "plan_date", "meal_type", "meal_plan_scope", name="unique_meal_scope"),
        Index("idx_meal_plan_family_date", "family_id", "plan_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    uuid: Mapped[str] = mapped_column(String(36), default=uuid_string, unique=True, nullable=False)
    family_id: Mapped[int] = mapped_column(ForeignKey("families.id", ondelete="CASCADE"), nullable=False, index=True)
    plan_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    day_of_week: Mapped[str] = mapped_column(String(20), nullable=False)
    meal_type: Mapped[str | None] = mapped_column(String(20))
    meal_name: Mapped[str | None] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    calories: Mapped[int | None] = mapped_column()
    prep_time: Mapped[int | None] = mapped_column()
    recipe_id: Mapped[int | None] = mapped_column(ForeignKey("recipes.id", ondelete="SET NULL"))
    color_class: Mapped[str] = mapped_column(String(64), default="bg-blue-500", nullable=False)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    assigned_to: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    meal_plan_scope: Mapped[str] = mapped_column(String(128), default="family", nullable=False, index=True)
    dietary_flags: Mapped[list[str] | None] = mapped_column(JSON)

    family: Mapped["Family"] = relationship(back_populates="meal_plans")
    recipe: Mapped["Recipe | None"] = relationship(back_populates="meal_plans")


class MealPlanTemplate(Base, TimestampMixin, ActiveMixin):
    __tablename__ = "meal_plan_templates"
    __table_args__ = (UniqueConstraint("template_scope", "template_name", "day_of_week", "meal_type", name="unique_template_scope"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    uuid: Mapped[str] = mapped_column(String(36), default=uuid_string, unique=True, nullable=False)
    template_name: Mapped[str] = mapped_column(String(255), nullable=False)
    day_of_week: Mapped[str | None] = mapped_column(String(20), index=True)
    meal_type: Mapped[str | None] = mapped_column(String(20))
    meal_name: Mapped[str | None] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    calories: Mapped[int | None] = mapped_column()
    prep_time: Mapped[int | None] = mapped_column()
    recipe_id: Mapped[int | None] = mapped_column(ForeignKey("recipes.id", ondelete="SET NULL"))
    family_id: Mapped[int | None] = mapped_column(ForeignKey("families.id", ondelete="CASCADE"), index=True)
    template_scope: Mapped[str] = mapped_column(String(128), default="global", nullable=False, index=True)
    is_global: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))


class Recipe(Base, TimestampMixin, ActiveMixin):
    __tablename__ = "recipes"
    __table_args__ = (Index("idx_recipe_name", "recipe_name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    uuid: Mapped[str] = mapped_column(String(36), default=uuid_string, unique=True, nullable=False)
    recipe_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    ingredients: Mapped[list[str] | None] = mapped_column(JSON)
    instructions: Mapped[str | None] = mapped_column(Text)
    prep_time: Mapped[int | None] = mapped_column()
    cook_time: Mapped[int | None] = mapped_column()
    servings: Mapped[int | None] = mapped_column()
    difficulty: Mapped[str | None] = mapped_column(String(20))
    cuisine: Mapped[str | None] = mapped_column(String(100))
    dietary_tags: Mapped[list[str] | None] = mapped_column(JSON)
    family_id: Mapped[int | None] = mapped_column(ForeignKey("families.id", ondelete="CASCADE"), index=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))

    meal_plans: Mapped[list["MealPlan"]] = relationship(back_populates="recipe")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    __table_args__ = (Index("idx_audit_created", "created_at"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    uuid: Mapped[str] = mapped_column(String(36), default=uuid_string, unique=True, nullable=False)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    family_id: Mapped[int | None] = mapped_column(ForeignKey("families.id", ondelete="SET NULL"), index=True)
    action: Mapped[str | None] = mapped_column(String(100))
    entity_type: Mapped[str | None] = mapped_column(String(50))
    entity_id: Mapped[str | None] = mapped_column(String(100))
    changes: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    ip_address: Mapped[str | None] = mapped_column(String(45))
    user_agent: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    uuid: Mapped[str] = mapped_column(String(36), default=uuid_string, unique=True, nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    family_id: Mapped[int | None] = mapped_column(ForeignKey("families.id", ondelete="SET NULL"), index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str | None] = mapped_column(Text)
    type: Mapped[str | None] = mapped_column(String(50))
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    family: Mapped["Family | None"] = relationship(back_populates="notifications")


class Announcement(Base):
    __tablename__ = "announcements"

    id: Mapped[int] = mapped_column(primary_key=True)
    family_id: Mapped[int] = mapped_column(ForeignKey("families.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    owner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    tag: Mapped[str] = mapped_column(String(50), default="family", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)


class EmergencyContact(Base):
    __tablename__ = "emergency_contacts"

    id: Mapped[int] = mapped_column(primary_key=True)
    family_id: Mapped[int] = mapped_column(ForeignKey("families.id", ondelete="CASCADE"), nullable=False, index=True)
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    value: Mapped[str] = mapped_column(String(100), nullable=False)
