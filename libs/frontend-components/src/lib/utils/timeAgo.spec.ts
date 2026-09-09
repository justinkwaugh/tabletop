import { afterEach, describe, expect, it, vi } from 'vitest'
import TimeAgo from 'javascript-time-ago'
import en from 'javascript-time-ago/locale/en'
import { createTimeAgo } from './timeAgo.js'

afterEach(() => {
    vi.restoreAllMocks()
})

describe('time-ago locale initialization', () => {
    it('supports multiple entry points and repeated initialization without locale errors', () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

        const formatters = [createTimeAgo(), createTimeAgo(), createTimeAgo()]

        expect(consoleError).not.toHaveBeenCalled()

        const now = Date.UTC(2026, 8, 8)
        for (const timeAgo of formatters) {
            expect(timeAgo.format(now - 60_000, { now })).toBe('1 minute ago')
        }
    })

    it('coexists with a legacy default registration on the same library instance', () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
        const beforeLegacy = createTimeAgo()
        TimeAgo.addDefaultLocale(en)
        const afterLegacy = createTimeAgo()

        const now = Date.UTC(2026, 8, 8)
        for (const timeAgo of [beforeLegacy, afterLegacy]) {
            expect(timeAgo.format(now - 60_000, { now })).toBe('1 minute ago')
        }
        expect(consoleError).not.toHaveBeenCalled()
    })
})
