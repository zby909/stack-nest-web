import { useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import { ConfigProvider, theme, type ThemeConfig } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import {
  AppearanceContext,
  normalizePreference,
  readThemePreference,
  themeStorageKey,
  type ColorMode,
  type ThemePreference,
} from '../lib/appearance'

// componentTheme 使用组件公开 token，确保选中项和主按钮在两种模式下都有足够对比度。
function componentTheme(mode: ColorMode): ThemeConfig {
  const dark = mode === 'dark'
  return {
    algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      borderRadius: 8,
      colorPrimary: dark ? '#c6d2e1' : '#18191c',
      colorTextLightSolid: dark ? '#15181d' : '#ffffff',
      colorText: dark ? '#e8edf5' : '#18191c',
      colorBgContainer: dark ? '#1d222a' : '#ffffff',
      colorBgElevated: dark ? '#252b35' : '#ffffff',
      controlItemBgActive: dark ? '#39485d' : '#e8edf3',
      controlItemBgActiveHover: dark ? '#425570' : '#dce4ef',
    },
    components: {
      Select: {
        optionSelectedBg: dark ? '#39485d' : '#e8edf3',
        optionSelectedColor: dark ? '#f4f7fc' : '#18191c',
        optionActiveBg: dark ? '#303946' : '#f1f3f6',
      },
      Menu: {
        itemSelectedBg: dark ? '#39485d' : '#e8edf3',
        itemSelectedColor: dark ? '#f4f7fc' : '#18191c',
      },
    },
  }
}

// ThemeProvider 统一页面与浮层配色，并同步系统及其他标签页的偏好变化。
export default function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState(readThemePreference)
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  )
  const mode: ColorMode = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference
  const componentTokens = useMemo(() => componentTheme(mode), [mode])

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = mode
  }, [mode])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    // 更新系统颜色，不覆盖用户明确选择的浅色或深色。
    const onSystemChange = () => setSystemDark(media.matches)
    // 清空存储时恢复跟随系统；忽略其他存储键。
    const onStorageChange = (event: StorageEvent) => {
      if (event.key === themeStorageKey || event.key === null) {
        setPreferenceState(normalizePreference(event.newValue))
      }
    }
    onSystemChange()
    media.addEventListener('change', onSystemChange)
    window.addEventListener('storage', onStorageChange)
    return () => {
      media.removeEventListener('change', onSystemChange)
      window.removeEventListener('storage', onStorageChange)
    }
  }, [])

  // 本地存储受限时仍切换当前页面，避免设置操作导致白屏。
  const setPreference = (next: ThemePreference) => {
    setPreferenceState(next)
    try {
      localStorage.setItem(themeStorageKey, next)
    } catch {
      // 只在当前标签页保留选择。
    }
  }

  return (
    <AppearanceContext.Provider value={{ preference, setPreference }}>
      <ConfigProvider
        locale={zhCN}
        theme={componentTokens}
        modal={{
          centered: true,
          classNames: {
            container: 'flex max-h-[calc(100dvh-2rem)] flex-col',
            header: 'shrink-0',
            body: '-mx-1 min-h-0 overflow-y-auto overscroll-contain px-1 [scrollbar-gutter:stable] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-line-strong',
            footer: 'shrink-0',
          },
        }}
      >
        {children}
      </ConfigProvider>
    </AppearanceContext.Provider>
  )
}
