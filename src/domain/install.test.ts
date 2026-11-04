import { describe, expect, it } from 'vitest'
import { getInstallMode, isIosDevice, isSnoozed, SNOOZE_DAYS } from './install'

const DAY = 86_400_000
const base = { standalone: false, hasPrompt: false, ios: false, now: 100 * DAY }

describe('isIosDevice', () => {
  it('detects iPhone, iPad and iPadOS-as-Mac', () => {
    expect(isIosDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)', 'iPhone', 5)).toBe(true)
    expect(isIosDevice('Mozilla/5.0 (iPad; CPU OS 16_0)', 'iPad', 5)).toBe(true)
    expect(isIosDevice('Mozilla/5.0 (Macintosh)', 'MacIntel', 5)).toBe(true)
  })
  it('rejects desktops and Android', () => {
    expect(isIosDevice('Mozilla/5.0 (Macintosh)', 'MacIntel', 0)).toBe(false)
    expect(isIosDevice('Mozilla/5.0 (Linux; Android 14)', 'Linux armv8l', 5)).toBe(false)
  })
})

describe('isSnoozed', () => {
  it('is false when never dismissed', () => expect(isSnoozed(undefined, 100 * DAY)).toBe(false))
  it('is true within the snooze window, false after', () => {
    expect(isSnoozed(100 * DAY - (SNOOZE_DAYS * DAY - 1), 100 * DAY)).toBe(true)
    expect(isSnoozed(100 * DAY - SNOOZE_DAYS * DAY, 100 * DAY)).toBe(false)
  })
})

describe('getInstallMode', () => {
  it('offers the native prompt when the browser provides it', () => {
    expect(getInstallMode({ ...base, hasPrompt: true })).toBe('prompt')
  })
  it('prefers the native prompt over the iOS hint', () => {
    expect(getInstallMode({ ...base, hasPrompt: true, ios: true })).toBe('prompt')
  })
  it('shows the manual hint on iOS only', () => {
    expect(getInstallMode({ ...base, ios: true })).toBe('ios-hint')
    expect(getInstallMode(base)).toBe('none')
  })
  it('shows nothing when already installed', () => {
    expect(getInstallMode({ ...base, hasPrompt: true, ios: true, standalone: true })).toBe('none')
  })
  it('shows nothing while snoozed, then again after', () => {
    expect(getInstallMode({ ...base, hasPrompt: true, dismissedAt: 95 * DAY })).toBe('none')
    expect(getInstallMode({ ...base, hasPrompt: true, dismissedAt: 80 * DAY })).toBe('prompt')
  })
})
