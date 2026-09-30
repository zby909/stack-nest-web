import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { StyleProvider } from '@ant-design/cssinjs'
import './index.css'
import AuthGate from './components/AuthGate'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StyleProvider layer>
      <ConfigProvider
        locale={zhCN}
        theme={{
          token: {
            colorPrimary: '#18191c',
            borderRadius: 8,
            colorText: '#18191c',
          },
        }}
      >
        <AuthGate />
      </ConfigProvider>
    </StyleProvider>
  </StrictMode>,
)
