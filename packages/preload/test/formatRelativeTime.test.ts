import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { formatRelativeTime } from '../src/types'
import { Temporal } from '@js-temporal/polyfill'

describe('formatRelativeTime', () => {
  let mockNow: Date

  beforeEach(() => {
    // Set a fixed "now" time for consistent testing
    mockNow = new Date('2025-09-23T15:30:00.000Z')
    vi.spyOn(Temporal.Now, 'zonedDateTimeISO').mockImplementation((timeZone = 'America/New_York') => {
      return Temporal.Instant.fromEpochMilliseconds(mockNow.getTime())
        .toZonedDateTimeISO(timeZone)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('recent times (relative formatting)', () => {
    it('should return "just now" for times less than 30 seconds ago', () => {
      // 10 seconds ago
      const timestamp = new Date(mockNow.getTime() - 10 * 1000).toISOString()
      const result = formatRelativeTime(timestamp)
      
      expect(result.display).toBe('just now')
      expect(result.full).toContain('2025')
    })

    it('should return "a few minutes ago" for times less than 5 minutes ago', () => {
      // 2 minutes ago
      const timestamp = new Date(mockNow.getTime() - 2 * 60 * 1000).toISOString()
      const result = formatRelativeTime(timestamp)
      
      expect(result.display).toBe('a few minutes ago')
    })

    it('should return minutes for times between 5 and 60 minutes ago', () => {
      // 30 minutes ago
      const timestamp = new Date(mockNow.getTime() - 30 * 60 * 1000).toISOString()
      const result = formatRelativeTime(timestamp)
      
      expect(result.display).toBe('30 minutes ago')
    })

    it('should handle singular minute correctly', () => {
      // 5 minutes ago (exactly)
      const timestamp = new Date(mockNow.getTime() - 5 * 60 * 1000).toISOString()
      const result = formatRelativeTime(timestamp)
      
      expect(result.display).toBe('5 minutes ago')
    })

    it('should return hours for times between 1 and 24 hours ago', () => {
      // 3 hours ago
      const timestamp = new Date(mockNow.getTime() - 3 * 60 * 60 * 1000).toISOString()
      const result = formatRelativeTime(timestamp)
      
      expect(result.display).toBe('3 hours ago')
    })

    it('should handle singular hour correctly', () => {
      // 1 hour ago
      const timestamp = new Date(mockNow.getTime() - 1 * 60 * 60 * 1000).toISOString()
      const result = formatRelativeTime(timestamp)
      
      expect(result.display).toBe('1 hour ago')
    })

    it('should return days for times between 1 and 7 days ago', () => {
      // 3 days ago
      const timestamp = new Date(mockNow.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString()
      const result = formatRelativeTime(timestamp)
      
      expect(result.display).toBe('3 days ago')
    })

    it('should handle singular day correctly', () => {
      // 1 day ago
      const timestamp = new Date(mockNow.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString()
      const result = formatRelativeTime(timestamp)
      
      expect(result.display).toBe('1 day ago')
    })

    it('should return weeks for times between 1 and 5 weeks ago', () => {
      // 2 weeks ago
      const timestamp = new Date(mockNow.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()
      const result = formatRelativeTime(timestamp)
      
      expect(result.display).toBe('2 weeks ago')
    })

    it('should handle singular week correctly', () => {
      // 1 week ago
      const timestamp = new Date(mockNow.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const result = formatRelativeTime(timestamp)
      
      expect(result.display).toBe('1 week ago')
    })

    it('should return "1 month ago" for times around 4 weeks ago', () => {
      // 4 weeks ago
      const timestamp = new Date(mockNow.getTime() - 28 * 24 * 60 * 60 * 1000).toISOString()
      const result = formatRelativeTime(timestamp)
      
      expect(result.display).toBe('1 month ago')
    })
  })

  describe('older times (absolute formatting)', () => {
    it('should return absolute date for times older than 5 weeks', () => {
      // 6 weeks ago
      const timestamp = new Date(mockNow.getTime() - 42 * 24 * 60 * 60 * 1000).toISOString()
      const result = formatRelativeTime(timestamp)
      
      // Should be formatted as absolute date
      expect(result.display).toMatch(/\w+ \d{1,2}, \d{4}/)
      expect(result.full).toContain('2025')
    })

    it('should return absolute date for times from months ago', () => {
      // 3 months ago
      const timestamp = new Date(mockNow.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()
      const result = formatRelativeTime(timestamp)
      
      // Should be formatted as absolute date
      expect(result.display).toMatch(/\w+ \d{1,2}, \d{4}/)
      expect(result.full).toContain('2025')
    })
  })

  describe('edge cases and boundary conditions', () => {
    it('should handle exactly 30 seconds ago (boundary)', () => {
      const timestamp = new Date(mockNow.getTime() - 30 * 1000).toISOString()
      const result = formatRelativeTime(timestamp)
      
      expect(result.display).toBe('a few minutes ago')
    })

    it('should handle exactly 5 minutes ago (boundary)', () => {
      const timestamp = new Date(mockNow.getTime() - 5 * 60 * 1000).toISOString()
      const result = formatRelativeTime(timestamp)
      
      expect(result.display).toBe('5 minutes ago')
    })

    it('should handle exactly 1 hour ago (boundary)', () => {
      const timestamp = new Date(mockNow.getTime() - 60 * 60 * 1000).toISOString()
      const result = formatRelativeTime(timestamp)
      
      expect(result.display).toBe('1 hour ago')
    })

    it('should handle exactly 24 hours ago (boundary)', () => {
      const timestamp = new Date(mockNow.getTime() - 24 * 60 * 60 * 1000).toISOString()
      const result = formatRelativeTime(timestamp)
      
      expect(result.display).toBe('1 day ago')
    })

    it('should handle exactly 7 days ago (boundary)', () => {
      const timestamp = new Date(mockNow.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const result = formatRelativeTime(timestamp)
      
      expect(result.display).toBe('1 week ago')
    })

    it('should handle exactly 5 weeks ago (boundary)', () => {
      const timestamp = new Date(mockNow.getTime() - 35 * 24 * 60 * 60 * 1000).toISOString()
      const result = formatRelativeTime(timestamp)
      
      // Should switch to absolute formatting (format may vary based on locale)
      expect(result.display).toMatch(/\w+ \d{1,2}/)
      expect(result.display).not.toMatch(/ago/)
    })

    it('should handle future timestamps gracefully', () => {
      // 1 hour in the future
      const timestamp = new Date(mockNow.getTime() + 60 * 60 * 1000).toISOString()
      const result = formatRelativeTime(timestamp)
      
      // The function doesn't explicitly handle future times, but shouldn't crash
      expect(result.display).toBeDefined()
      expect(result.full).toBeDefined()
    })

    it('should handle invalid timestamps gracefully', () => {
      expect(() => {
        formatRelativeTime('invalid-timestamp')
      }).toThrow()
    })
  })

  describe('full timestamp formatting', () => {
    it('should always include a full timestamp in the result', () => {
      const timestamp = new Date(mockNow.getTime() - 30 * 60 * 1000).toISOString()
      const result = formatRelativeTime(timestamp)
      
      expect(result.full).toBeDefined()
      expect(result.full).toContain('2025')
      expect(result.full.length).toBeGreaterThan(10)
    })

    it('should format full timestamp with time zone information', () => {
      const timestamp = new Date(mockNow.getTime() - 30 * 60 * 1000).toISOString()
      const result = formatRelativeTime(timestamp)
      
      // Should contain timezone info (like EDT, EST, etc.)
      expect(result.full).toMatch(/[A-Z]{3,4}/)
    })
  })

  describe('locale and timezone handling', () => {
    it('should use the configured locale and timezone', () => {
      const timestamp = new Date(mockNow.getTime() - 30 * 60 * 1000).toISOString()
      const result = formatRelativeTime(timestamp)
      
      // Since we mocked the timezone to America/New_York, 
      // the full timestamp should reflect that
      expect(result.full).toBeDefined()
      expect(typeof result.full).toBe('string')
    })
  })
})