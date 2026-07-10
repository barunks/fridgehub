import {
  BarChart3,
  Bot,
  CalendarDays,
  ClipboardList,
  Home,
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
  implementation: '/implementation',
}

export const navItems: NavItem[] = [
  { key: 'dashboard', label: 'Home', icon: Home, path: viewPaths.dashboard },
  { key: 'tasks', label: 'Tasks', icon: ClipboardList, path: viewPaths.tasks },
  { key: 'groceries', label: 'Groceries', icon: ShoppingBasket, path: viewPaths.groceries },
  { key: 'meals', label: 'Meals', icon: CalendarDays, path: viewPaths.meals },
  { key: 'family', label: 'Family', icon: Users, path: viewPaths.family },
  { key: 'analytics', label: 'Analytics', icon: BarChart3, path: viewPaths.analytics },
  { key: 'assistant', label: 'Ask AI', icon: Bot, path: viewPaths.assistant },
  { key: 'implementation', label: 'Build', icon: Settings2, path: viewPaths.implementation },
]

export const viewForPath = (pathname: string): ViewKey => {
  const match = Object.entries(viewPaths).find(([, path]) => path === pathname)
  return (match?.[0] as ViewKey | undefined) ?? 'dashboard'
}
