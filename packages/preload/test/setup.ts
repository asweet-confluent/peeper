import { vi, beforeEach } from 'vitest'

// Mock navigator.language for consistent testing
Object.defineProperty(navigator, 'language', {
  writable: true,
  value: 'en-US'
})

// Mock Intl.DateTimeFormat for timezone consistency
beforeEach(() => {
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
    locale: 'en-US',
    timeZone: 'America/New_York',
    calendar: 'gregory',
    numberingSystem: 'latn',
    hour12: true,
    hourCycle: 'h12',
    weekday: undefined,
    era: undefined,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short'
  } as any)
})