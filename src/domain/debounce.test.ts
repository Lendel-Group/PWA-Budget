import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDebounced } from './debounce'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('createDebounced', () => {
  it('collapses bursts into one trailing call', () => {
    const fn = vi.fn()
    const d = createDebounced(fn, 1500)
    d(); vi.advanceTimersByTime(1000)
    d(); vi.advanceTimersByTime(1000)
    expect(fn).not.toHaveBeenCalled()
    expect(d.pending()).toBe(true)
    vi.advanceTimersByTime(500)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(d.pending()).toBe(false)
  })
  it('cancel prevents the call; cancel when idle is safe', () => {
    const fn = vi.fn()
    const d = createDebounced(fn, 100)
    d.cancel()
    d(); d.cancel()
    vi.advanceTimersByTime(500)
    expect(fn).not.toHaveBeenCalled()
  })
})
