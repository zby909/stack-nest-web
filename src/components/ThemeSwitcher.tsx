import { Button, Dropdown } from 'antd'
import {
  normalizePreference,
  themeLabels,
  useAppearance,
  type ThemePreference,
} from '../lib/appearance'

// ThemeIcon 使用太阳、月亮和明暗对半图标表达外观选项。
function ThemeIcon({ mode }: { mode?: ThemePreference }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {mode === 'light' ? (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </>
      ) : mode === 'dark' ? (
        <path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z" />
      ) : (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor" stroke="none" />
        </>
      )}
    </svg>
  )
}

// ThemeSwitcher 在点击菜单中切换外观，触屏和键盘均可操作。
export default function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const { preference, setPreference } = useAppearance()
  return (
    <Dropdown
      trigger={['click']}
      menu={{
        selectable: true,
        selectedKeys: [preference],
        items: (['light', 'dark', 'system'] as const).map((value) => ({
          key: value,
          label: themeLabels[value],
          icon: <ThemeIcon mode={value} />,
        })),
        onClick: ({ key }) => setPreference(normalizePreference(key)),
      }}
    >
      <Button
        className={`min-h-11 shrink-0 ${compact ? 'min-w-11' : ''}`}
        icon={<ThemeIcon />}
        aria-label={`切换主题，当前：${themeLabels[preference]}`}
        title={`外观：${themeLabels[preference]}`}
      >
        {compact ? null : themeLabels[preference]}
      </Button>
    </Dropdown>
  )
}
