import type { LucideIcon } from 'lucide-react'

export type ViewKey =
  | 'dashboard'
  | 'groceries'
  | 'meals'
  | 'tasks'
  | 'family'
  | 'analytics'
  | 'assistant'
  | 'history'
  | 'demo'
  | 'command-center'

export type TimeScope = 'today' | 'week'

export interface ScopedNavigationOptions {
  scope?: TimeScope
}

export type Priority = 'low' | 'medium' | 'high'
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'
export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'semi_annually' | 'yearly'
export type Frequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'semi_annually' | 'yearly'
export type MealType = 'breakfast' | 'lunch' | 'snacks' | 'dinner'
export type WeekDay = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
export type Permission =
  | 'view_dashboard'
  | 'view_tasks'
  | 'view_groceries'
  | 'view_meals'
  | 'view_family'
  | 'view_analytics'
  | 'use_assistant'
  | 'view_demo'
  | 'view_audit'
  | 'view_cache_stats'
  | 'manage_tasks'
  | 'manage_groceries'
  | 'manage_grocery_types'
  | 'manage_meals'
  | 'manage_recipes'
  | 'manage_family'
  | 'manage_announcements'
  | 'manage_contacts'
  | 'mark_notifications'

export interface NavItem {
  key: ViewKey
  label: string
  icon: LucideIcon
  path: string
  requiredPermission?: Permission
}

export interface CurrentSession {
  userId: number
  familyId: number
  role: string
  capabilities: Permission[]
}

export interface Family {
  id: number
  familyName: string
  homeBase: string
  timezone: string
  planStatus: 'demo' | 'api-ready'
}

export interface FamilyMember {
  id: number
  name: string
  role: string
  permissions: Permission[]
  colorClass: string
  initial: string
  status: string
  points: number
  dietaryNotes?: string[]
}

export interface GroceryListType {
  id: number
  listName: string
  listType: string
  description: string
  colorClass: string
}

export interface GroceryItem {
  id: number
  itemNumber: string
  itemName: string
  listTypeId: number
  quantity: number
  unit: string
  purchaseFrequency: Frequency
  currentStock: boolean
  startDate: string
  expiryDate?: string | null
  notes: string
  familyId: number
  purchased: boolean
  needsPurchase: boolean
}

export interface GroceryCycle {
  id: number
  listTypeId: number
  frequency: Frequency
  cycleStartDate: string
  cycleEndDate: string
  isCompleted: boolean
}

export interface ShoppingCycleItem {
  id: number
  cycleId: number
  itemId: number
  itemNumber: string
  itemName: string
  listTypeId: number
  frequency: Frequency
  quantity: number
  unit: string
  isPurchased: boolean
  purchasedQuantity: number
  notes: string
  isAdhoc: boolean
  carriedForward: boolean
}

export interface Task {
  id: number
  title: string
  description: string
  priority: Priority
  status: TaskStatus
  dueAt: string
  reminderAt?: string | null
  recurrenceType: RecurrenceType
  recurrenceInterval: number
  recurrenceEndAt?: string | null
  assignedTo: number
  category: string
  actionLabel?: string
}

export interface MealPlanItem {
  id: number
  planDate: string
  dayOfWeek: string
  mealType: MealType
  mealName: string
  description: string
  calories: number
  prepTime: number
  recipeId?: number | null
  colorClass: string
  assignedTo?: number | null
  mealPlanScope?: string
  targetMemberIds?: number[]
  dietaryFlags?: string[]
  updatedAt?: string | null
}

export interface MealUpdateInput {
  mealName?: string
  description?: string
  calories?: number
  prepTime?: number
  assignedTo?: number | null
  targetMemberIds?: number[]
  dietaryFlags?: string[]
  recipeId?: number | null
  effectiveScope?: 'daily' | 'weekly' | 'monthly'
  effectiveUntil?: string
}

export interface MealTemplateRow {
  id: number
  templateName: string
  dayOfWeek: WeekDay
  mealType: MealType
  mealName: string
  description: string
  calories: number
  prepTime: number
  recipeId?: number | null
  isGlobal: boolean
  isEditable: boolean
  createdAt: string
  updatedAt: string
}

export interface MealTemplateRowInput {
  templateName: string
  dayOfWeek: WeekDay
  mealType: MealType
  mealName: string
  description?: string
  calories?: number
  prepTime?: number
  recipeId?: number | null
}

export interface Recipe {
  id: number
  recipeName: string
  description: string
  ingredients: string[]
  prepTime: number
  cookTime: number
  servings: number
  difficulty: 'easy' | 'medium' | 'hard'
  cuisine: string
  dietaryTags: string[]
}

export interface Notification {
  id: number
  title: string
  message: string
  type: 'task' | 'grocery' | 'meal' | 'family' | 'system'
  isRead: boolean
  createdAt: string
}

export interface Announcement {
  id: number
  title: string
  message: string
  ownerId: number
  createdAt: string
  tag: string
}

export interface EmergencyContact {
  id: number
  label: string
  value: string
}

export interface AssistantInsight {
  id: string
  title: string
  body: string
  type: 'schedule' | 'grocery' | 'meal' | 'task' | 'family'
  confidence: number
  action?: string
  severity?: 'critical' | 'warning' | 'info'
  route?: string | null
}

export interface AssistantMessage {
  id: number
  sender: 'user' | 'assistant'
  content: string
  createdAt: string
}

export interface FamilyHubState {
  currentUser: CurrentSession
  capabilities: Permission[]
  family: Family
  members: FamilyMember[]
  listTypes: GroceryListType[]
  groceryItems: GroceryItem[]
  groceryCycles: GroceryCycle[]
  shoppingItems: ShoppingCycleItem[]
  tasks: Task[]
  meals: MealPlanItem[]
  recipes: Recipe[]
  notifications: Notification[]
  announcements: Announcement[]
  emergencyContacts: EmergencyContact[]
  assistantMessages: AssistantMessage[]
  assistantInsights: AssistantInsight[]
}

export interface AuditLogEntry {
  id: number
  userId?: number | null
  action?: string | null
  entityType?: string | null
  entityId?: string | null
  changes?: Record<string, unknown> | null
  ipAddress?: string | null
  userAgent?: string | null
  createdAt: string
}

export interface NewGroceryItemInput {
  itemName: string
  listTypeId: number
  quantity: number
  unit: string
  purchaseFrequency: Frequency
  currentStock: boolean
  notes: string
  startDate?: string
}

export interface GroceryItemUpdateInput {
  itemName?: string
  listTypeId?: number
  quantity?: number
  unit?: string
  purchaseFrequency?: Frequency
  currentStock?: boolean
  startDate?: string
  notes?: string
  expiryDate?: string | null
  purchased?: boolean
}

export interface NewShoppingItemInput {
  itemName: string
  listTypeId: number
  quantity: number
  unit: string
  purchaseFrequency: Frequency
  notes: string
}

export interface ShoppingItemUpdateInput {
  quantity?: number
  unit?: string
  isPurchased?: boolean
  purchasedQuantity?: number
  notes?: string
}

export interface NewTaskInput {
  title: string
  category: string
  priority: Priority
  dueAt: string
  reminderAt?: string | null
  assignedTo: number
  description?: string
  recurrenceType?: RecurrenceType
  recurrenceInterval?: number
  recurrenceEndAt?: string | null
}

export interface TaskUpdateInput {
  title?: string
  description?: string
  category?: string
  priority?: Priority
  status?: TaskStatus
  dueAt?: string
  reminderAt?: string | null
  assignedTo?: number
  recurrenceType?: RecurrenceType
  recurrenceInterval?: number
  recurrenceEndAt?: string | null
}

export interface GroceryType {
  id: number
  typeName: string
  description?: string
  icon?: string
  color?: string
  isSystem: boolean
}

export interface FrequencyType {
  id: number
  name: string
  days: number
}

export interface DeviceInfo {
  id: number
  deviceId: string
  deviceName: string
  deviceType: string
  platform: string | null
  ipAddress: string | null
  isActive: boolean
  isRevoked: boolean
  isTrusted: boolean
  registeredAt: string
  lastUsedAt: string
}

export interface DevicePolicy {
  maxDevices: number
  activeDeviceCount: number
}

export type SignupDeviceType = 'phone' | 'tablet' | 'desktop' | 'browser' | 'other'

export interface SignupDeviceInput {
  deviceId: string
  deviceName: string
  deviceType: SignupDeviceType
  platform?: string | null
}

export interface SignupStatus {
  bootstrapAllowed: boolean
}

export interface SignupInvite {
  id: number
  inviteToken?: string | null
  email?: string | null
  role: string
  permissions: Permission[]
  maxUses: number
  usedCount: number
  expiresAt: string
  createdAt: string
  isActive: boolean
}

export interface SignupInvitePreview {
  familyName: string
  email?: string | null
  role: string
  expiresAt: string
}

export interface SignupInviteCreateInput {
  email?: string
  role: string
  permissions?: Permission[]
  expiresInDays: number
  maxUses: number
}

export interface BootstrapSignupInput extends SignupDeviceInput {
  familyName: string
  homeBase: string
  timezone: string
  fullName: string
  email: string
  username: string
  password: string
}

export interface InviteSignupInput extends SignupDeviceInput {
  inviteToken: string
  fullName: string
  email: string
  username: string
  password: string
}
