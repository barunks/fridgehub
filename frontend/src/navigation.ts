import {
  BarChart3,
  Bot,
  CalendarDays,
  ClipboardList,
  History,
  Home,
  LayoutGrid,
  Settings2,
  ShoppingBasket,
  Users,
} from 'lucide-react'
import type { NavItem, ViewKey } from '@/types/familyHub'

export const viewPaths: Record<ViewKey, string> = {
  dashboard: '/',
  tasks: '/tasks',
  groceries: '/groceries',
  meals: '/meals',
  family: '/family',
  analytics: '/analytics',
  assistant: '/assistant',
  'command-center': '/command-center',
  history: '/history',
  implementation: '/implementation',
}

export const navItems: NavItem[] = [
  { key: 'dashboard', label: 'Home', icon: Home, path: viewPaths.dashboard, requiredPermission: 'view_dashboard' },
  { key: 'tasks', label: 'Tasks', icon: ClipboardList, path: viewPaths.tasks, requiredPermission: 'view_tasks' },
  { key: 'groceries', label: 'Groceries', icon: ShoppingBasket, path: viewPaths.groceries, requiredPermission: 'view_groceries' },
  { key: 'meals', label: 'Meals', icon: CalendarDays, path: viewPaths.meals, requiredPermission: 'view_meals' },
  { key: 'family', label: 'Family', icon: Users, path: viewPaths.family, requiredPermission: 'view_family' },
  { key: 'analytics', label: 'Analytics', icon: BarChart3, path: viewPaths.analytics, requiredPermission: 'view_analytics' },
  { key: 'command-center', label: 'Admin', icon: LayoutGrid, path: viewPaths['command-center'], requiredPermission: 'manage_family' },
  { key: 'assistant', label: 'Ask AI', icon: Bot, path: viewPaths.assistant, requiredPermission: 'use_assistant' },
  { key: 'history', label: 'History', icon: History, path: viewPaths.history, requiredPermission: 'view_audit' },
  { key: 'implementation', label: 'Build', icon: Settings2, path: viewPaths.implementation, requiredPermission: 'view_implementation' },
]

export const viewForPath = (pathname: string): ViewKey => {
  const match = Object.entries(viewPaths).find(([, path]) => path === pathname)
  return (match?.[0] as ViewKey | undefined) ?? 'dashboard'
}
