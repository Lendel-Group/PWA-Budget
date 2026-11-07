import { describe, expect, it, vi } from 'vitest'
import { APPLY_TIMEOUT_MS, applyUpdate, type SwContainer, type SwWorker } from './applyUpdate'

function fakes(withWaiting: boolean) {
  const listeners: Record<string, (() => void)[]> = {}
  const on = (type: string, fn: () => void) => { (listeners[type] ??= []).push(fn) }
  const fire = (type: string) => listeners[type]?.forEach((fn) => fn())
  const worker = { state: 'installed', postMessage: vi.fn(), addEventListener: (t: string, fn: () => void) => on(`w:${t}`, fn) }
  const container: SwContainer = {
    getRegistration: async () => ({ waiting: withWaiting ? (worker as SwWorker) : null }),
    addEventListener: (t, fn) => on(t, fn),
  }
  const timers: (() => void)[] = []
  const setTimer = (fn: () => void, ms: number) => { expect(ms).toBe(APPLY_TIMEOUT_MS); timers.push(fn) }
  return { container, worker, fire, timers, setTimer }
}

describe('applyUpdate', () => {
  it('ожидающему воркеру — SKIP_WAITING, перезагрузка после активации и только один раз', async () => {
    const f = fakes(true)
    const reload = vi.fn()
    await applyUpdate(f.container, reload, f.setTimer)
    expect(f.worker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
    expect(reload).not.toHaveBeenCalled()
    f.worker.state = 'activated'
    f.fire('w:statechange')
    f.fire('controllerchange')
    f.timers.forEach((t) => t())
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('смена контроллера без statechange — тоже перезагрузка', async () => {
    const f = fakes(true)
    const reload = vi.fn()
    await applyUpdate(f.container, reload, f.setTimer)
    f.fire('controllerchange')
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('событий нет (iOS из фона) — перезагрузка по таймауту', async () => {
    const f = fakes(true)
    const reload = vi.fn()
    await applyUpdate(f.container, reload, f.setTimer)
    f.worker.state = 'activating'
    f.fire('w:statechange')
    expect(reload).not.toHaveBeenCalled()
    f.timers.forEach((t) => t())
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('ожидающего нет — новая версия уже активна, сразу перезагрузка', async () => {
    const f = fakes(false)
    const reload = vi.fn()
    await applyUpdate(f.container, reload, f.setTimer)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('без сервис-воркеров и при ошибке регистрации — перезагрузка', async () => {
    const reload = vi.fn()
    await applyUpdate(undefined, reload)
    expect(reload).toHaveBeenCalledTimes(1)
    const broken: SwContainer = { getRegistration: () => Promise.reject(new Error('x')), addEventListener: () => {} }
    await applyUpdate(broken, reload)
    expect(reload).toHaveBeenCalledTimes(2)
  })
})
