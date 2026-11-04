import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db/schema'
import { getStoredRates, refreshRates, setManualRates } from './ratesService'

const file = (date: string, usd = 450) => JSON.stringify({ date, source: 's', fetchedAt: 'f', rates: { USD: usd, EUR: 500, KRW: 0.3 } })
const ok = (body: string) => vi.fn(async () => new Response(body, { status: 200 })) as unknown as typeof fetch
const failing = (e: unknown) => vi.fn(async () => { throw e }) as unknown as typeof fetch

beforeEach(async () => {
  await db.config.clear()
  vi.spyOn(console, 'info').mockImplementation(() => {})
})

describe('ratesService', () => {
  it('loads latest.json and stores the file date', async () => {
    const f = ok(file('2026-11-04'))
    const r = await refreshRates('2026-11-04', f, false, 'https://example.test/latest.json')
    expect(r.fetched).toBe(true)
    expect(r.rates).toEqual({ rates: { USD: 450, EUR: 500 }, date: '2026-11-04', source: 'nbk' })
    expect(await getStoredRates()).toEqual(r.rates)
    expect((f as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe('https://example.test/latest.json')
  })

  it('skips the network when rates for today are already stored (any source)', async () => {
    await setManualRates({ USD: 400 }, '2026-11-04')
    const f = ok(file('2026-11-04'))
    const r = await refreshRates('2026-11-04', f)
    expect(r).toMatchObject({ fetched: false, rates: { source: 'manual' } })
    expect(f).not.toHaveBeenCalled()
  })

  it('force refetches even if rates are from today', async () => {
    await setManualRates({ USD: 400 }, '2026-11-04')
    const r = await refreshRates('2026-11-04', ok(file('2026-11-04', 455)), true)
    expect(r).toMatchObject({ fetched: true, rates: { source: 'nbk', rates: { USD: 455 } } })
  })

  it('does not replace stored rates with an older file', async () => {
    await setManualRates({ USD: 400 }, '2026-11-05')
    const r = await refreshRates('2026-11-06', ok(file('2026-11-04')))
    expect(r).toMatchObject({ fetched: false, rates: { date: '2026-11-05', source: 'manual' } })
  })

  it('keeps cached rates on network error, HTTP error and invalid files', async () => {
    await setManualRates({ USD: 400 }, '2026-11-03')
    const http = vi.fn(async () => new Response('x', { status: 500 })) as unknown as typeof fetch
    for (const f of [failing(new Error('offline')), http, ok('{"date":"x"}'), ok('not json')]) {
      const r = await refreshRates('2026-11-04', f)
      expect(r).toMatchObject({ fetched: false, rates: { rates: { USD: 400 } } })
    }
  })

  it('handles non-Error rejections with nothing cached', async () => {
    expect(await refreshRates('2026-11-04', failing('offline'))).toEqual({ rates: undefined, fetched: false })
  })
})
