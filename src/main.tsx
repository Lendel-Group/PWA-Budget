import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { seedIfEmpty } from './db/seed'
import { installAutoBackupHooks } from './services/backupService'
import { requestPersistentStorage } from './services/storageService'

async function bootstrap() {
  installAutoBackupHooks()
  await seedIfEmpty()
  await requestPersistentStorage()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

bootstrap().catch((e) => console.error('[bootstrap] failed', e))
