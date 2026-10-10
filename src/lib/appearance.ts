import { createContext, useContext } from 'react'

export type ThemePreference = 'light' | 'dark' | 'system'
export type ColorMode = Exclude<ThemePreference, 'system'>
export const themeStorageKey = 'stacknest:theme'
export const themeLabels: Record<ThemePreference, string> = {
  light: '浅色',
  dark: '深色',
  system: '跟随系统',
}

export const AppearanceContext = createContext<{
  preference: ThemePreference
  setPreference: (preference: ThemePreference) => void
} | null>(null)

// normalizePreference 忽略无效或旧的设置，默认跟随系统。
export function normalizePreference(value: string | null): ThemePreference {
  return value === 'light' || value === 'dark' ? value : 'system'
}

// readThemePreference 在浏览器禁止本地存储时仍允许正常使用页面。
export function readThemePreference(): ThemePreference {
  try {
    return normalizePreference(localStorage.getItem(themeStorageKey))
  } catch {
    return 'system'
  }
}

// useAppearance 让登录页与管理端共用同一份主题偏好。
export function useAppearance() {
  const appearance = useContext(AppearanceContext)
  if (!appearance) throw new Error('缺少主题提供器')
  return appearance
}
