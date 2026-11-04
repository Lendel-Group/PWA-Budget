import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db/schema'
import { getStoredRates, refreshRates, setManualRates } from './ratesService'

const xml = '<item><title>USD</title><description>450</description><quant>1</quant></item>'
const ok = (body: string) => vi.fn(async () => new Response(body, { status: 200 })) as unknown as typeof fetch

beforeEach(async () => {
  await db.config.clear()
  vi.spyOn(console, 'info').mockImplementation(() => {})
})

describe('ratesService', () => {
  it('fetches and caches NBK rates', async () => {
    const r = await refreshRates('2026-11-04', ok(xml))
    expect(r).toEqual({ rates: { USD: 450 }, date: '2026-11-04', source: 'nbk' })
    expect(await getStoredRates()).toEqual(r)
  })
  it('does not refetch within the same day', async () => {
    await setManualRates({ USD: 400 }, '2026-11-04')
    const f = ok(xml)
    expect((await refreshRates('2026-11-04', f))?.source).toBe('manual')
    expect(f).not.toHaveBeenCalled()
  })
  it('keeps cached rates on network error, HTTP error and junk', async () => {
    await setManualRates({ USD: 400 }, '2026-11-03')
    const failing = vi.fn(async () => { throw new Error('CORS') }) as unknown as typeof fetch
    expect((await refreshRates('2026-11-04', failing))?.rates).toEqual({ USD: 400 })
    const http = vi.fn(async () => new Response('x', { status: 500 })) as unknown as typeof fetch
    expect((await refreshRates('2026-11-04', http))?.rates).toEqual({ USD: 400 })
    expect((await refreshRates('2026-11-04', ok('<html/>')))?.rates).toEqual({ USD: 400 })
  })
  it('returns undefined with nothing cached and no network', async () => {
    const failing = vi.fn(async () => { throw 'offline' }) as unknown as typeof fetch
    expect(await refreshRates('2026-11-04', failing)).toBeUndefined()
  })
})
