import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import { Keyboard, KeyboardResize } from '@capacitor/keyboard'
import { SplashScreen } from '@capacitor/splash-screen'
import App from './App'
import './index.css'

const setupNativeMobileRuntime = async () => {
  if (!Capacitor.isNativePlatform()) {
    return
  }

  try {
    await StatusBar.setStyle({ style: Style.Dark })
    await StatusBar.setBackgroundColor({ color: '#b8860b' })
    await Keyboard.setResizeMode({ mode: KeyboardResize.Body })
    await SplashScreen.hide()
  } catch {
    // Ignore plugin errors to avoid breaking app startup on unsupported platforms.
  }
}

void setupNativeMobileRuntime()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)