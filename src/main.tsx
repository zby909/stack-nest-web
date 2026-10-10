import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { StyleProvider } from '@ant-design/cssinjs'
import './index.css'
import AuthGate from './components/AuthGate'
import ThemeProvider from './components/ThemeProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StyleProvider layer>
      <ThemeProvider>
        <AuthGate />
      </ThemeProvider>
    </StyleProvider>
  </StrictMode>,
)
