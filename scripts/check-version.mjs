// Проверка SemVer в PR: если менялся код приложения, версия в package.json должна вырасти,
// а в CHANGELOG.md должна быть запись с этой версией.
// Использование: node scripts/check-version.mjs <base-ref>   (например origin/main)
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const base = process.argv[2] ?? 'origin/main'
const APP_PATHS = ['src/', 'public/', 'index.html', 'app/', 'vite.config.ts']

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()

export function parse(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v)
  if (!m) throw new Error(`Версия «${v}» не в формате MAJOR.MINOR.PATCH`)
  return m.slice(1).map(Number)
}

export function isGreater(a, b) {
  const [x, y] = [parse(a), parse(b)]
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]
  return false
}

function main() {
  const changed = git('diff', '--name-only', `${base}...HEAD`).split('\n').filter(Boolean)
  const appChanged = changed.filter((f) => APP_PATHS.some((p) => f === p || f.startsWith(p)))
  if (appChanged.length === 0) {
    console.log('Код приложения не менялся — версию поднимать не нужно.')
    return
  }

  const oldVersion = JSON.parse(git('show', `${base}:package.json`)).version
  const newVersion = JSON.parse(readFileSync('package.json', 'utf8')).version
  const fail = (msg) => {
    console.error(`::error::${msg}`)
    console.error(`Изменены файлы приложения:\n  ${appChanged.slice(0, 10).join('\n  ')}`)
    process.exit(1)
  }

  if (!isGreater(newVersion, oldVersion)) {
    fail(
      `Версия не повышена (${oldVersion} → ${newVersion}). Поднимите её по SemVer: ` +
        'исправление → PATCH, новая функция → MINOR, несовместимое изменение → MAJOR.',
    )
  }
  const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'))
  if (lock.version !== newVersion || lock.packages?.['']?.version !== newVersion) {
    fail(`Версия в package-lock.json не совпадает с package.json (${newVersion}). Выполните «npm install --package-lock-only».`)
  }
  if (!readFileSync('CHANGELOG.md', 'utf8').includes(`## [${newVersion}]`)) {
    fail(`В CHANGELOG.md нет раздела «## [${newVersion}]».`)
  }
  console.log(`Версия ${oldVersion} → ${newVersion}, запись в CHANGELOG есть.`)
}

if (import.meta.url === `file://${process.argv[1]}`) main()
