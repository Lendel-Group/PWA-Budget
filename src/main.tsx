import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { seedIfEmpty } from './db/seed'
import { initOnboarding } from './services/onboardingService'
import { initWelcome } from './services/welcomeService'
import { captureInstallPrompt } from './lib/install'
import { toLocalDateString } from './domain/dates'
import { refreshRates } from './services/ratesService'
import { installAutoBackupHooks } from './services/backupService'
import { requestPersistentStorage } from './services/storageService'
import { applyTheme, readThemeMode, watchSystemTheme } from './lib/theme'

captureInstallPrompt() // событие beforeinstallprompt может прийти до первого рендера
applyTheme(readThemeMode()) // тему уже поставил скрипт в index.html; здесь — theme-color и подписка на систему
watchSystemTheme()

async function bootstrap() {
  installAutoBackupHooks()
  await seedIfEmpty()
  await initOnboarding()
  await initWelcome()
  await requestPersistentStorage()
  void refreshRates(toLocalDateString(new Date())) // не блокирует запуск; офлайн — остаётся кэш
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

bootstrap().catch((e) => console.error('[bootstrap] failed', e))
