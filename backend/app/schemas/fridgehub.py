from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

Priority = Literal["low", "medium", "high"]
TaskStatus = Literal["pending", "in_progress", "completed", "cancelled"]
RecurrenceType = Literal["none", "daily", "weekly", "monthly", "quarterly", "semi_annually", "yearly"]
Frequency = Literal["daily", "weekly", "monthly", "quarterly", "semi_annually", "yearly"]
MealType = Literal["breakfast", "lunch", "snacks", "dinner"]
WeekDay = Literal["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
MealEffectiveScope = Literal["daily", "weekly", "monthly"]


def normalize_week_day(value: str) -> str:
    normalized = value.strip().lower()
    if normalized not in ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"):
        raise ValueError("dayOfWeek must be monday, tuesday, wednesday, thursday, friday, saturday, or sunday")
    return normalized


class CamelModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class ErrorDetail(CamelModel):
    """Standard error response body."""
    detail: str
    code: str = "error"
    field: str | None = None


class ErrorResponse(CamelModel):
    """Envelope for all API error responses."""
    error: ErrorDetail


class ValidationErrorItem(CamelModel):
    field: str
    message: str


class ValidationErrorResponse(CamelModel):
    """Returned on request body validation failures."""
    error: ErrorDetail
    validationErrors: list[ValidationErrorItem] = []


class TokenResponse(CamelModel):
    accessToken: str
    refreshToken: str | None = None
    tokenType: str = "bearer"


class RefreshRequest(CamelModel):
    refreshToken: str | None = None
    familyId: int | None = None


class LoginRequest(CamelModel):
    username: str
    password: str
    familyId: int | None = None
    deviceId: str | None = None
    deviceName: str | None = None
    deviceType: str | None = None
    platform: str | None = None


class DeviceRegistrationRequest(CamelModel):
    deviceId: str = Field(min_length=8, max_length=100)
    deviceName: str = Field(min_length=1, max_length=255)
    deviceType: Literal["phone", "tablet", "desktop", "browser", "other"] = "browser"
    platform: str | None = Field(default=None, max_length=100)


def validate_password_strength(value: str) -> str:
    if any(character.isspace() for character in value):
        raise ValueError("Password cannot contain whitespace")
    if not any(character.isalpha() for character in value) or not any(character.isdigit() for character in value):
        raise ValueError("Password must include at least one letter and one number")
    return value


class ChangePasswordRequest(CamelModel):
    currentPassword: str = Field(min_length=1)
    newPassword: str = Field(min_length=8, max_length=128)

    @field_validator("newPassword")
    @classmethod
    def validate_new_password(cls, value: str) -> str:
        return validate_password_strength(value)


class SignupStatusOut(CamelModel):
    bootstrapAllowed: bool


class SignupInviteCreate(CamelModel):
    email: str | None = Field(default=None, max_length=255)
    role: str = Field(default="member", min_length=1, max_length=50)
    permissions: list[str] | None = None
    expiresInDays: int = Field(default=7, ge=1, le=30)
    maxUses: int = Field(default=1, ge=1, le=10)


class SignupInviteOut(CamelModel):
    id: int
    inviteToken: str | None = None
    email: str | None = None
    role: str
    permissions: list[str]
    maxUses: int
    usedCount: int
    expiresAt: datetime
    createdAt: datetime
    isActive: bool


class SignupInvitePreviewOut(CamelModel):
    familyName: str
    email: str | None = None
    role: str
    expiresAt: datetime


class BootstrapSignupRequest(DeviceRegistrationRequest):
    familyName: str = Field(min_length=1, max_length=255)
    homeBase: str = Field(default="Singapore", min_length=1, max_length=255)
    timezone: str = Field(default="Asia/Singapore", min_length=1, max_length=64)
    fullName: str = Field(min_length=1, max_length=255)
    email: str = Field(min_length=3, max_length=255)
    username: str = Field(min_length=2, max_length=100)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def validate_bootstrap_password(cls, value: str) -> str:
        return validate_password_strength(value)


class InviteSignupRequest(DeviceRegistrationRequest):
    inviteToken: str = Field(min_length=16)
    fullName: str = Field(min_length=1, max_length=255)
    email: str = Field(min_length=3, max_length=255)
    username: str = Field(min_length=2, max_length=100)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def validate_signup_password(cls, value: str) -> str:
        return validate_password_strength(value)


class FamilyOut(CamelModel):
    id: int
    familyName: str
    homeBase: str
    timezone: str
    planStatus: Literal["demo", "api-ready"] = "api-ready"


class FamilyMemberOut(CamelModel):
    id: int
    name: str
    role: str
    permissions: list[str] = []
    colorClass: str
    initial: str
    status: str
    points: int
    dietaryNotes: list[str] | None = None


class FamilyMemberCreate(CamelModel):
    name: str = Field(min_length=1, max_length=255)
    email: str = Field(min_length=3, max_length=255)
    username: str = Field(min_length=2, max_length=100)
    password: str = Field(min_length=8, max_length=128)
    role: str = "member"
    permissions: list[str] | None = None
    status: str = "Active"
    colorClass: str = "bg-slate-500"
    dietaryNotes: list[str] | None = None

    @field_validator("password")
    @classmethod
    def validate_member_password(cls, value: str) -> str:
        return validate_password_strength(value)


class FamilyMemberUpdate(CamelModel):
    name: str | None = None
    role: str | None = None
    permissions: list[str] | None = None
    status: str | None = None
    colorClass: str | None = None
    points: int | None = None
    dietaryNotes: list[str] | None = None


class CurrentSessionOut(CamelModel):
    userId: int
    familyId: int
    role: str
    capabilities: list[str]


class GroceryListTypeOut(CamelModel):
    id: int
    listName: str
    listType: str
    description: str
    colorClass: str


class GroceryListTypeCreate(CamelModel):
    listName: str = Field(min_length=1, max_length=100)
    description: str = ""
    colorClass: str = "bg-slate-500"


class GroceryListTypeUpdate(CamelModel):
    listName: str | None = None
    description: str | None = None
    colorClass: str | None = None


class GroceryTypeOut(CamelModel):
    id: int
    typeName: str
    description: str | None = None
    icon: str | None = None
    color: str | None = None
    isSystem: bool = False


class GroceryTypeCreate(CamelModel):
    typeName: str = Field(min_length=1, max_length=50)
    description: str | None = None
    icon: str | None = None
    color: str | None = None


class GroceryTypeUpdate(CamelModel):
    typeName: str | None = None
    description: str | None = None
    icon: str | None = None
    color: str | None = None


class FrequencyTypeOut(CamelModel):
    id: int
    frequencyName: str
    daysInterval: int
    displayOrder: int | None = None


class GroceryItemOut(CamelModel):
    id: int
    itemNumber: str
    itemName: str
    listTypeId: int
    quantity: Decimal | float
    unit: str
    purchaseFrequency: Frequency
    currentStock: bool
    startDate: date
    expiryDate: date | None = None
    notes: str
    familyId: int
    purchased: bool
    needsPurchase: bool


class GroceryItemCreate(CamelModel):
    itemName: str = Field(min_length=1, max_length=255)
    listTypeId: int
    quantity: Decimal | float = 1
    unit: str = "Unit"
    purchaseFrequency: Frequency = "weekly"
    currentStock: bool = False
    startDate: date | None = None
    notes: str = ""
    expiryDate: date | None = None


class GroceryItemUpdate(CamelModel):
    itemName: str | None = None
    listTypeId: int | None = None
    quantity: Decimal | float | None = None
    unit: str | None = None
    purchaseFrequency: Frequency | None = None
    currentStock: bool | None = None
    purchased: bool | None = None
    startDate: date | None = None
    notes: str | None = None
    expiryDate: date | None = None


class GroceryCycleOut(CamelModel):
    id: int
    listTypeId: int
    frequency: Frequency
    cycleStartDate: date
    cycleEndDate: date
    isCompleted: bool


class ShoppingCycleItemOut(CamelModel):
    id: int
    cycleId: int
    itemId: int
    itemNumber: str
    itemName: str
    listTypeId: int
    frequency: Frequency
    quantity: Decimal | float
    unit: str
    isPurchased: bool
    purchasedQuantity: Decimal | float
    notes: str
    isAdhoc: bool = False
    carriedForward: bool = False


class ShoppingItemUpdate(CamelModel):
    quantity: Decimal | float | None = Field(default=None, ge=0)
    unit: str | None = Field(default=None, max_length=20)
    isPurchased: bool | None = None
    purchasedQuantity: Decimal | float | None = Field(default=None, ge=0)
    notes: str | None = None


class ShoppingAdhocCreate(CamelModel):
    itemName: str = Field(min_length=1, max_length=255)
    listTypeId: int
    quantity: Decimal | float = Field(default=1, gt=0)
    unit: str = Field(default="Units", max_length=20)
    purchaseFrequency: Frequency = "weekly"
    notes: str = ""


class TaskOut(CamelModel):
    id: int
    title: str
    description: str
    priority: Priority
    status: TaskStatus
    dueAt: datetime
    reminderAt: datetime | None = None
    recurrenceType: RecurrenceType
    recurrenceInterval: int
    recurrenceEndAt: datetime | None = None
    assignedTo: int
    category: str
    actionLabel: str | None = None


class TaskCreate(CamelModel):
    title: str = Field(min_length=1, max_length=255)
    category: str = "chore"
    priority: Priority = "medium"
    dueAt: datetime
    reminderAt: datetime | None = None
    assignedTo: int
    description: str | None = None
    recurrenceType: RecurrenceType = "none"
    recurrenceInterval: int = 1
    recurrenceEndAt: datetime | None = None


class TaskUpdate(CamelModel):
    title: str | None = None
    description: str | None = None
    priority: Priority | None = None
    status: TaskStatus | None = None
    dueAt: datetime | None = None
    reminderAt: datetime | None = None
    recurrenceType: RecurrenceType | None = None
    recurrenceInterval: int | None = None
    recurrenceEndAt: datetime | None = None
    assignedTo: int | None = None
    category: str | None = None


class MealPlanItemOut(CamelModel):
    id: int
    planDate: date
    dayOfWeek: str
    mealType: MealType
    mealName: str
    description: str
    calories: int
    prepTime: int
    recipeId: int | None = None
    colorClass: str
    assignedTo: int | None = None
    mealPlanScope: str = "family"
    targetMemberIds: list[int] = []
    dietaryFlags: list[str] = []
    updatedAt: datetime | None = None


class MealUpdate(CamelModel):
    mealName: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    calories: int | None = Field(default=None, ge=0, le=5000)
    prepTime: int | None = Field(default=None, ge=0, le=1440)
    assignedTo: int | None = None
    targetMemberIds: list[int] | None = Field(default=None, max_length=20)
    dietaryFlags: list[str] | None = Field(default=None, max_length=12)
    recipeId: int | None = None
    effectiveScope: MealEffectiveScope | None = None
    effectiveUntil: date | None = None


class ApplyTemplateRequest(CamelModel):
    templateName: str | None = Field(default=None, min_length=1, max_length=255)
    memberId: int | None = None
    allMembers: bool = False


class MealTemplateRowOut(CamelModel):
    id: int
    templateName: str
    dayOfWeek: WeekDay
    mealType: MealType
    mealName: str
    description: str
    calories: int
    prepTime: int
    recipeId: int | None = None
    isGlobal: bool
    isEditable: bool
    createdAt: datetime
    updatedAt: datetime


class MealTemplateRowCreate(CamelModel):
    templateName: str = Field(min_length=1, max_length=255)
    dayOfWeek: WeekDay
    mealType: MealType
    mealName: str = Field(min_length=1, max_length=255)
    description: str = Field(default="", max_length=2000)
    calories: int = Field(default=0, ge=0, le=5000)
    prepTime: int = Field(default=0, ge=0, le=1440)
    recipeId: int | None = None

    @field_validator("dayOfWeek", mode="before")
    @classmethod
    def _normalize_day(cls, value: str) -> str:
        return normalize_week_day(str(value))


class MealTemplateRowUpdate(CamelModel):
    templateName: str | None = Field(default=None, min_length=1, max_length=255)
    dayOfWeek: WeekDay | None = None
    mealType: MealType | None = None
    mealName: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    calories: int | None = Field(default=None, ge=0, le=5000)
    prepTime: int | None = Field(default=None, ge=0, le=1440)
    recipeId: int | None = None

    @field_validator("dayOfWeek", mode="before")
    @classmethod
    def _normalize_day(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return normalize_week_day(str(value))


class RecipeOut(CamelModel):
    id: int
    recipeName: str
    description: str
    ingredients: list[str]
    prepTime: int
    cookTime: int
    servings: int
    difficulty: Literal["easy", "medium", "hard"]
    cuisine: str
    dietaryTags: list[str]


class RecipeCreate(CamelModel):
    recipeName: str = Field(min_length=1, max_length=255)
    description: str = ""
    ingredients: list[str] = []
    instructions: str = ""
    prepTime: int = 0
    cookTime: int = 0
    servings: int = 1
    difficulty: Literal["easy", "medium", "hard"] = "easy"
    cuisine: str = ""
    dietaryTags: list[str] = []


class RecipeUpdate(CamelModel):
    recipeName: str | None = None
    description: str | None = None
    ingredients: list[str] | None = None
    instructions: str | None = None
    prepTime: int | None = None
    cookTime: int | None = None
    servings: int | None = None
    difficulty: Literal["easy", "medium", "hard"] | None = None
    cuisine: str | None = None
    dietaryTags: list[str] | None = None


class NotificationOut(CamelModel):
    id: int
    title: str
    message: str
    type: Literal["task", "grocery", "meal", "family", "system"]
    isRead: bool
    createdAt: datetime


class AnnouncementOut(CamelModel):
    id: int
    title: str
    message: str
    ownerId: int
    createdAt: datetime
    tag: str


class AnnouncementCreate(CamelModel):
    title: str = Field(min_length=1, max_length=255)
    message: str = Field(min_length=1)
    ownerId: int = 1
    tag: str = "family"


class EmergencyContactOut(CamelModel):
    id: int
    label: str
    value: str


class EmergencyContactCreate(CamelModel):
    label: str = Field(min_length=1, max_length=100)
    value: str = Field(min_length=1, max_length=100)


class EmergencyContactUpdate(CamelModel):
    label: str | None = None
    value: str | None = None


class DeviceOut(CamelModel):
    id: int
    deviceId: str
    deviceName: str
    deviceType: str
    platform: str | None = None
    ipAddress: str | None = None
    isActive: bool
    isRevoked: bool
    isTrusted: bool
    registeredAt: datetime
    lastUsedAt: datetime


class DeviceUpdate(CamelModel):
    deviceName: str | None = None
    isTrusted: bool | None = None


class DevicePolicyOut(CamelModel):
    maxDevices: int
    activeDeviceCount: int


class DevicePolicyUpdate(CamelModel):
    maxDevices: int = Field(ge=1, le=20)


class AssistantInsightOut(CamelModel):
    id: str
    title: str
    body: str
    type: Literal["schedule", "grocery", "meal", "task", "family"]
    confidence: int
    action: str | None = None
    severity: Literal["critical", "warning", "info"] = "info"
    route: str | None = None


class AssistantMessageOut(CamelModel):
    id: int
    sender: Literal["user", "assistant"]
    content: str
    createdAt: datetime


class AssistantRequest(CamelModel):
    query: str = Field(min_length=1, max_length=500)

    @field_validator("query")
    @classmethod
    def validate_query(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Query cannot be blank")
        return stripped


class AssistantResponse(CamelModel):
    answer: str
    insights: list[AssistantInsightOut]


class AuditLogOut(CamelModel):
    id: int
    userId: int | None = None
    action: str | None = None
    entityType: str | None = None
    entityId: str | None = None
    changes: dict | None = None
    ipAddress: str | None = None
    userAgent: str | None = None
    createdAt: datetime


class BootstrapState(CamelModel):
    currentUser: CurrentSessionOut
    capabilities: list[str]
    family: FamilyOut
    members: list[FamilyMemberOut]
    listTypes: list[GroceryListTypeOut]
    groceryItems: list[GroceryItemOut]
    groceryCycles: list[GroceryCycleOut]
    shoppingItems: list[ShoppingCycleItemOut] = []
    tasks: list[TaskOut]
    meals: list[MealPlanItemOut]
    recipes: list[RecipeOut]
    notifications: list[NotificationOut]
    announcements: list[AnnouncementOut]
    emergencyContacts: list[EmergencyContactOut]
    assistantMessages: list[AssistantMessageOut]
    assistantInsights: list[AssistantInsightOut]
