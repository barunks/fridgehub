import type { LucideIcon } from 'lucide-react'

export type ViewKey =
  | 'dashboard'
  | 'groceries'
  | 'meals'
  | 'tasks'
  | 'family'
  | 'assistant'
  | 'implementation'

export type Priority = 'low' | 'medium' | 'high'
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'
export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
export type Frequency = 'daily' | 'weekly' | 'monthly' | 'quarterly'
export type MealType = 'breakfast' | 'lunch' | 'snacks' | 'dinner'

export interface NavItem {
  key: ViewKey
  label: string
  icon: LucideIcon
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
  expiryDate?: string
  notes: string
  familyId: number
  purchased: boolean
}

export interface GroceryCycle {
  id: number
  listTypeId: number
  frequency: Frequency
  cycleStartDate: string
  cycleEndDate: string
  isCompleted: boolean
}

export interface Task {
  id: number
  title: string
  description: string
  priority: Priority
  status: TaskStatus
  dueAt: string
  reminderAt: string
  recurrenceType: RecurrenceType
  recurrenceInterval: number
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
  recipeId?: number
  colorClass: string
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
}

export interface AssistantMessage {
  id: number
  sender: 'user' | 'assistant'
  content: string
  createdAt: string
}

export interface FamilyHubState {
  family: Family
  members: FamilyMember[]
  listTypes: GroceryListType[]
  groceryItems: GroceryItem[]
  groceryCycles: GroceryCycle[]
  tasks: Task[]
  meals: MealPlanItem[]
  recipes: Recipe[]
  notifications: Notification[]
  announcements: Announcement[]
  emergencyContacts: EmergencyContact[]
  assistantMessages: AssistantMessage[]
}

export interface NewGroceryItemInput {
  itemName: string
  listTypeId: number
  quantity: number
  unit: string
  purchaseFrequency: Frequency
  currentStock: boolean
  notes: string
}

export interface NewTaskInput {
  title: string
  category: string
  priority: Priority
  dueAt: string
  assignedTo: number
}
