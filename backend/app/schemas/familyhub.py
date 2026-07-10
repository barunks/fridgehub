from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Priority = Literal["low", "medium", "high"]
TaskStatus = Literal["pending", "in_progress", "completed", "cancelled"]
RecurrenceType = Literal["none", "daily", "weekly", "monthly", "yearly"]
Frequency = Literal["daily", "weekly", "monthly", "quarterly"]
MealType = Literal["breakfast", "lunch", "snacks", "dinner"]


class CamelModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)


class TokenResponse(CamelModel):
    accessToken: str
    refreshToken: str
    tokenType: str = "bearer"


class RefreshRequest(CamelModel):
    refreshToken: str


class LoginRequest(CamelModel):
    username: str
    password: str


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
    status: str = "Active"
    colorClass: str = "bg-slate-500"
    dietaryNotes: list[str] | None = None


class FamilyMemberUpdate(CamelModel):
    name: str | None = None
    role: str | None = None
    status: str | None = None
    colorClass: str | None = None
    points: int | None = None
    dietaryNotes: list[str] | None = None


class GroceryListTypeOut(CamelModel):
    id: int
    listName: str
    listType: str
    description: str
    colorClass: str


class GroceryTypeOut(CamelModel):
    id: int
    typeName: str
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


class GroceryItemCreate(CamelModel):
    itemName: str = Field(min_length=1, max_length=255)
    listTypeId: int
    quantity: Decimal | float = 1
    unit: str = "Unit"
    purchaseFrequency: Frequency = "weekly"
    currentStock: bool = False
    notes: str = ""
    expiryDate: date | None = None


class GroceryItemUpdate(CamelModel):
    itemName: str | None = None
    quantity: Decimal | float | None = None
    unit: str | None = None
    purchaseFrequency: Frequency | None = None
    currentStock: bool | None = None
    purchased: bool | None = None
    notes: str | None = None
    expiryDate: date | None = None


class GroceryCycleOut(CamelModel):
    id: int
    listTypeId: int
    frequency: Frequency
    cycleStartDate: date
    cycleEndDate: date
    isCompleted: bool


class TaskOut(CamelModel):
    id: int
    title: str
    description: str
    priority: Priority
    status: TaskStatus
    dueAt: datetime
    reminderAt: datetime
    recurrenceType: RecurrenceType
    recurrenceInterval: int
    assignedTo: int
    category: str
    actionLabel: str | None = None


class TaskCreate(CamelModel):
    title: str = Field(min_length=1, max_length=255)
    category: str = "chore"
    priority: Priority = "medium"
    dueAt: datetime
    assignedTo: int
    description: str | None = None
    recurrenceType: RecurrenceType = "none"
    recurrenceInterval: int = 1


class TaskUpdate(CamelModel):
    title: str | None = None
    description: str | None = None
    priority: Priority | None = None
    status: TaskStatus | None = None
    dueAt: datetime | None = None
    reminderAt: datetime | None = None
    recurrenceType: RecurrenceType | None = None
    recurrenceInterval: int | None = None
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


class MealUpdate(CamelModel):
    mealName: str = Field(min_length=1, max_length=255)


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


class AssistantInsightOut(CamelModel):
    id: str
    title: str
    body: str
    type: Literal["schedule", "grocery", "meal", "task", "family"]
    confidence: int
    action: str | None = None


class AssistantMessageOut(CamelModel):
    id: int
    sender: Literal["user", "assistant"]
    content: str
    createdAt: datetime


class AssistantRequest(CamelModel):
    query: str = Field(min_length=1)


class AssistantResponse(CamelModel):
    answer: str
    insights: list[AssistantInsightOut]


class BootstrapState(CamelModel):
    family: FamilyOut
    members: list[FamilyMemberOut]
    listTypes: list[GroceryListTypeOut]
    groceryItems: list[GroceryItemOut]
    groceryCycles: list[GroceryCycleOut]
    tasks: list[TaskOut]
    meals: list[MealPlanItemOut]
    recipes: list[RecipeOut]
    notifications: list[NotificationOut]
    announcements: list[AnnouncementOut]
    emergencyContacts: list[EmergencyContactOut]
    assistantMessages: list[AssistantMessageOut]
