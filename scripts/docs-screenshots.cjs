// Скриншоты экранов приложения для «Инструкции» на сайте MBT (Lendel-Group/mbt, src/pages/docs).
// Поднимает Vite dev-сервер, заполняет IndexedDB демо-данными и снимает экраны в размере iPhone 13.
// Дата в приложении зафиксирована (FIXED_NOW), поэтому картинки воспроизводимы.
//
//   node scripts/docs-screenshots.cjs [папка]   (по умолчанию ../mbt/public/docs/img — клон сайта рядом)
//
// Нужен Playwright с Chromium (npx playwright install chromium). Результат — <папка>/*.jpg.
const path = require('node:path')
const fs = require('node:fs')
const { chromium, devices } = require('playwright')

const ROOT = path.resolve(__dirname, '..')
const OUT = path.resolve(process.argv[2] ?? path.join(ROOT, '../mbt/public/docs/img'))
const FIXED_NOW = new Date('2026-11-18T14:20:00')
const TODAY = '2026-11-18'

// ---------- Демо-данные ----------

/** Детерминированный ГПСЧ: одинаковые данные при каждом запуске. */
function rng(seed) {
  let s = seed
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296)
}

const pad = (n) => String(n).padStart(2, '0')
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`
const daysIn = (y, m) => new Date(y, m, 0).getDate()

function buildDemo() {
  const rand = rng(42)
  const pick = (arr) => arr[Math.floor(rand() * arr.length)]
  const between = (a, b, step = 10) => Math.round((a + rand() * (b - a)) / step) * step
  const created = '2026-01-01T09:00:00.000Z'

  const accounts = [
    { id: 'acc-1-kaspi', name: 'Kaspi Gold', type: 'card', currency: 'KZT', initialBalance: 180000 },
    { id: 'acc-2-cash', name: 'Наличные', type: 'cash', currency: 'KZT', initialBalance: 150000 },
    { id: 'acc-3-deposit', name: 'Депозит', type: 'deposit', currency: 'KZT', initialBalance: 400000 },
    { id: 'acc-4-usd', name: 'Карта USD', type: 'card', currency: 'USD', initialBalance: 1200 },
  ].map((a, i) => ({ ...a, currentBalance: a.initialBalance, isArchived: false, createdAt: `2026-01-01T09:0${i}:00.000Z` }))

  const debts = [
    { id: 'debt-car', name: 'Кредит на авто', totalAmount: 2400000, remainingAmount: 2400000, monthlyPayment: 85000, dueDay: 25, interestRate: 18.5, createdAt: created, isClosed: false },
  ]
  const goals = [
    { id: 'goal-trip', title: 'Отпуск в Турции', targetAmount: 900000, currentAmount: 0, targetDate: '2027-06-01', icon: 'Plane', color: '#22c55e', isAchieved: false },
    { id: 'goal-fund', title: 'Подушка безопасности', targetAmount: 1500000, currentAmount: 0, targetDate: '2027-12-31', icon: 'Shield', color: '#3b82f6', isAchieved: false },
  ]

  const txs = []
  let seq = 0
  const add = (date, t) => {
    const [y, m, d] = date.split('-').map(Number)
    const hour = 8 + Math.floor(rand() * 13)
    txs.push({
      id: `tx-${++seq}`,
      date,
      timestamp: new Date(y, m - 1, d, hour, Math.floor(rand() * 60)).getTime(),
      isExcludedFromNoSpend: false,
      ...t,
    })
  }

  const daily = [
    { cat: 'cat-food', p: 0.45, min: 1800, max: 9500, comments: ['Magnum', 'Small', 'Рынок', ''] },
    { cat: 'cat-cafe', p: 0.2, min: 1500, max: 7000, comments: ['Кофе', 'Обед', ''] },
    { cat: 'cat-transport', p: 0.3, min: 300, max: 2500, comments: ['Такси', 'Автобус', ''] },
    { cat: 'cat-fun', p: 0.06, min: 3000, max: 12000, comments: ['Кино', ''] },
    { cat: 'cat-health', p: 0.04, min: 2500, max: 15000, comments: ['Аптека', ''] },
    { cat: 'cat-clothes', p: 0.03, min: 8000, max: 30000, comments: [''] },
    { cat: 'cat-other', p: 0.04, min: 1000, max: 6000, comments: [''] },
  ]

  for (let m = 1; m <= 11; m++) {
    const last = m === 11 ? 18 : daysIn(2026, m)
    for (let d = 1; d <= last; d++) {
      const date = iso(2026, m, d)
      if (d === 5) add(date, { type: 'income', accountId: 'acc-1-kaspi', categoryId: 'cat-salary', amount: 420000, comment: 'Зарплата' })
      if (d === 10) add(date, { type: 'expense', accountId: 'acc-1-kaspi', categoryId: 'cat-housing', amount: between(38000, 52000, 100), isExcludedFromNoSpend: true, comment: 'Коммуналка' })
      if (d === 12) add(date, { type: 'expense', accountId: 'acc-1-kaspi', categoryId: 'cat-comm', amount: 6990, comment: 'Интернет + связь' })
      if (d === 20 && m < 11) add(date, { type: 'expense', accountId: 'acc-1-kaspi', amount: 30000, goalId: 'goal-trip', isExcludedFromNoSpend: true })
      if (d === 21 && m < 11) add(date, { type: 'expense', accountId: 'acc-1-kaspi', amount: 45000, goalId: 'goal-fund', isExcludedFromNoSpend: true })
      if (d === 25 && m < 11) add(date, { type: 'expense', accountId: 'acc-1-kaspi', categoryId: 'cat-credit', amount: 85000, debtId: 'debt-car', isExcludedFromNoSpend: true })
      if (d === 6 && m % 2 === 0) add(date, { type: 'transfer', accountId: 'acc-1-kaspi', toAccountId: 'acc-3-deposit', amount: 50000 })
      if (d === 15 && m % 3 === 0) add(date, { type: 'income', accountId: 'acc-1-kaspi', categoryId: 'cat-side', amount: between(30000, 80000, 1000), comment: 'Фриланс' })
      // Ноябрь, 14–18: серия дней без трат (на главной видна серия, а «Сегодня» и «Вчера» не пустые)
      if (m === 11 && d >= 14) continue
      // Примерно каждый пятый день — без трат
      if (rand() < 0.2) continue
      let any = false
      for (const c of daily) {
        if (rand() < c.p) {
          any = true
          add(date, { type: 'expense', accountId: rand() < 0.95 ? 'acc-1-kaspi' : 'acc-2-cash', categoryId: c.cat, amount: between(c.min, c.max), comment: pick(c.comments) || undefined })
        }
      }
      if (!any) add(date, { type: 'expense', accountId: 'acc-1-kaspi', categoryId: 'cat-food', amount: between(2000, 6000), comment: 'Small' })
    }
  }
  // Последние дни: доход, перевод, пополнение цели и коммуналка — всё это не нарушает «дни без трат»
  add('2026-11-17', { type: 'expense', accountId: 'acc-1-kaspi', amount: 30000, goalId: 'goal-trip', isExcludedFromNoSpend: true })
  add('2026-11-17', { type: 'expense', accountId: 'acc-1-kaspi', categoryId: 'cat-housing', amount: 12500, isExcludedFromNoSpend: true, comment: 'Вывоз мусора' })
  add('2026-11-18', { type: 'income', accountId: 'acc-1-kaspi', categoryId: 'cat-side', amount: 45000, comment: 'Фриланс' })
  add('2026-11-18', { type: 'transfer', accountId: 'acc-1-kaspi', toAccountId: 'acc-3-deposit', amount: 60000 })
  txs.forEach((t) => { if (t.comment === undefined) delete t.comment })

  // Балансы, остаток долга и накопления целей — из операций
  const byId = Object.fromEntries(accounts.map((a) => [a.id, a]))
  for (const t of txs) {
    if (t.type === 'income') byId[t.accountId].currentBalance += t.amount
    else if (t.type === 'expense') byId[t.accountId].currentBalance -= t.amount
    else { byId[t.accountId].currentBalance -= t.amount; byId[t.toAccountId].currentBalance += t.toAmount ?? t.amount }
    if (t.debtId) debts[0].remainingAmount -= t.amount
    if (t.goalId) goals.find((g) => g.id === t.goalId).currentAmount += t.amount
  }

  const limit = { 'cat-food': 110000, 'cat-cafe': 35000, 'cat-transport': 25000, 'cat-housing': 60000, 'cat-credit': 85000, 'cat-health': 15000, 'cat-fun': 20000, 'cat-clothes': 25000, 'cat-comm': 7000, 'cat-other': 10000 }
  const budgetLimits = []
  for (const m of [9, 10, 11]) {
    for (const [categoryId, plannedAmount] of Object.entries(limit)) {
      budgetLimits.push({ id: `2026-${m}-${categoryId}`, year: 2026, month: m, categoryId, plannedAmount })
    }
  }

  const config = [
    { key: 'fx_rates', value: { rates: { USD: 512.4, EUR: 553.8, RUB: 6.35 }, date: TODAY, source: 'nbk' } },
    { key: 'onboarding', value: 'dismissed' },
    { key: 'storage_persisted', value: true },
    { key: 'last_backup_date', value: '2026-11-16T21:04:00.000Z' },
    { key: 'last_account_id', value: 'acc-1-kaspi' },
  ]
  return { accounts, transactions: txs, budgetLimits, debts, goals, config }
}

/** Записывает демо-данные прямо в IndexedDB приложения (поверх стартового сида). */
async function loadDemo(page, demo) {
  await page.evaluate(async (data) => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('BudgetDatabase')
      r.onsuccess = () => res(r.result)
      r.onerror = () => rej(r.error)
    })
    const stores = Object.keys(data)
    await new Promise((res, rej) => {
      const tx = db.transaction(stores, 'readwrite')
      for (const s of stores) {
        if (s !== 'config') tx.objectStore(s).clear()
        for (const row of data[s]) tx.objectStore(s).put(row)
      }
      tx.oncomplete = res
      tx.onerror = () => rej(tx.error)
    })
    db.close()
  }, demo)
}

// ---------- Съёмка ----------

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const { createServer } = await import('vite')
  const server = await createServer({ root: ROOT, server: { port: 5199, strictPort: true }, logLevel: 'error' })
  await server.listen()
  const APP = 'http://localhost:5199/'

  // Русская локаль и для системных полей (дата показывается как 01.03.2027)
  const browser = await chromium.launch({ args: ['--lang=ru-RU'], env: { ...process.env, LANG: 'ru_RU.UTF-8', LANGUAGE: 'ru' } })
  const newPage = async () => {
    // Масштаб 2× вместо 3× у iPhone: в инструкции скриншоты не шире ~300 px, так файлы вдвое легче
    const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 2, locale: 'ru-RU', timezoneId: 'Asia/Almaty', colorScheme: 'dark' }) // тема «как в системе» → тёмная, как прежние скриншоты
    // Курсы не запрашиваем из сети, карточку установки не показываем
    await ctx.route('**/latest.json', (r) => r.abort())
    await ctx.addInitScript(() => localStorage.setItem('install-dismissed-at', String(Date.now())))
    const page = await ctx.newPage()
    await page.clock.setFixedTime(FIXED_NOW)
    return page
  }
  const shot = async (page, name, opts = {}) => {
    await page.waitForTimeout(350)
    await page.screenshot({ path: path.join(OUT, `${name}.jpg`), type: 'jpeg', quality: 82, ...opts })
    console.log('  ✓', name)
  }
  const go = async (page, hash) => {
    await page.goto(`${APP}#/${hash}`)
    await page.waitForSelector('main section')
    await page.waitForTimeout(400)
  }
  const scrollTo = (page, selector) =>
    page.locator(selector).first().evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 64))

  // 1. Первый запуск: чек-лист «С чего начать»
  {
    const page = await newPage()
    await go(page, 'home')
    await page.waitForSelector('[data-testid="onboarding"]')
    await shot(page, 'onboarding')
    await page.context().close()
  }

  // 2. Основные экраны на демо-данных
  const page = await newPage()
  await go(page, 'home')
  await loadDemo(page, buildDemo())
  await page.reload() // Dexie не видит записи из чужого соединения — перечитываем страницу
  await page.waitForSelector('[data-testid="allowance"]')
  await shot(page, 'home')
  await page.getByRole('button', { name: /Общий капитал/ }).click()
  await shot(page, 'home-capital')
  await page.getByRole('button', { name: /Общий капитал/ }).click()

  // Добавление операции
  await page.getByRole('button', { name: 'Добавить операцию' }).click()
  for (const k of ['4', '8', '5', '0']) await page.getByRole('button', { name: k, exact: true }).click()
  await page.getByRole('radio', { name: /Продукты/ }).click()
  await shot(page, 'add-expense')
  await page.getByRole('button', { name: /^Ещё/ }).click()
  await page.getByRole('textbox', { name: 'Комментарий' }).fill('Magnum, продукты на неделю')
  await page.getByRole('textbox', { name: 'Комментарий' }).blur()
  await shot(page, 'add-more')
  await page.getByRole('button', { name: 'Закрыть' }).click()
  await page.getByRole('button', { name: 'Добавить операцию' }).click()
  await page.getByRole('radio', { name: 'Перевод' }).click()
  for (const k of ['1', '0', '0']) await page.getByRole('button', { name: k, exact: true }).click()
  await page.getByRole('radiogroup', { name: 'Счёт списания' }).getByRole('radio', { name: /Карта USD/ }).click()
  await page.getByRole('radiogroup', { name: 'Счёт зачисления' }).getByRole('radio', { name: /Kaspi Gold/ }).click()
  await page.getByText(/Сумма зачисления/).locator('..').locator('input').fill('51240')
  await shot(page, 'add-transfer')
  await page.getByRole('button', { name: 'Закрыть' }).click()

  // Свайп по строке операции — раскрывается «Удалить»
  const row = page.locator('ul[aria-label="Сегодня"] li').first()
  const box = await row.boundingBox()
  await page.mouse.move(box.x + box.width - 30, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width - 90, box.y + box.height / 2, { steps: 5 })
  await page.mouse.move(box.x + box.width - 140, box.y + box.height / 2, { steps: 5 })
  await page.mouse.up()
  await scrollTo(page, 'ul[aria-label="Сегодня"]')
  await shot(page, 'swipe-delete')

  // Бюджет
  await go(page, 'budget')
  await shot(page, 'budget')
  await page.getByRole('button', { name: /Следующий месяц/ }).click()
  await shot(page, 'budget-empty')

  // Операции
  await go(page, 'transactions')
  await shot(page, 'transactions')
  await page.getByRole('radio', { name: 'Расходы' }).click()
  await page.getByLabel('Категория').selectOption('cat-cafe')
  await page.getByLabel('Период').selectOption('month')
  await shot(page, 'transactions-filter')

  // Аналитика
  await go(page, 'analytics')
  await shot(page, 'analytics')
  await scrollTo(page, '[data-testid="by-category"]')
  await shot(page, 'analytics-categories')
  await scrollTo(page, '[data-testid="summary"]')
  await shot(page, 'analytics-table')

  // Дни без трат
  await go(page, 'nospend')
  await shot(page, 'nospend')
  await page.getByRole('button', { name: /17 ноября|Вчера/ }).first().click()
  await shot(page, 'nospend-day')

  // Цели и долги
  await go(page, 'goals')
  await shot(page, 'goals')
  await page.getByRole('button', { name: 'Пополнить' }).first().click()
  await page.getByLabel('Сумма, ₸').fill('30000')
  await shot(page, 'goal-topup')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Добавить цель' }).click()
  await page.getByLabel('Название').fill('Новый ноутбук')
  await page.getByLabel('Сумма, ₸').fill('650000')
  await page.getByLabel('Дата').fill('2027-03-01')
  await page.getByLabel('Название').focus()
  await shot(page, 'goal-add')
  await page.keyboard.press('Escape')

  await go(page, 'debts')
  await shot(page, 'debts')
  await page.getByRole('button', { name: 'Внести платёж' }).click()
  await shot(page, 'debt-pay')
  await page.keyboard.press('Escape')

  // Настройки — строки со сводкой; разделы — отдельные экраны
  await go(page, 'settings')
  await shot(page, 'settings')
  await go(page, 'accounts')
  await shot(page, 'accounts')
  await page.getByRole('button', { name: 'Добавить счёт' }).click()
  await page.getByLabel('Название').fill('Halyk Bank')
  await page.getByLabel('Начальный остаток').fill('125000')
  await shot(page, 'account-add')
  await page.keyboard.press('Escape')
  await go(page, 'rates')
  await shot(page, 'settings-rates')
  await go(page, 'backup')
  await shot(page, 'settings-backup')
  await go(page, 'settings')
  await page.getByRole('button', { name: 'Полный сброс приложения' }).click()
  await page.getByRole('textbox').last().fill('СБРОС')
  await shot(page, 'danger-reset')
  await page.keyboard.press('Escape')

  // Категории — отдельный экран из «Настроек»
  await go(page, 'categories')
  await shot(page, 'categories')
  await page.getByRole('button', { name: /Жильё и коммуналка/ }).click()
  await shot(page, 'category-edit')

  await browser.close()
  await server.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
