import { describe, expect, it } from 'vitest'
import { theirLocalTimeText, timeDifferenceText } from './timeDifference'

describe('timeDifferenceText', () => {
    it('says how far ahead or behind the other player is', () => {
        expect(timeDifferenceText(-5, 1)).toBe('6 h behind')
        expect(timeDifferenceText(9, 0)).toBe('9 h ahead')
        expect(timeDifferenceText(1, 1)).toBe('same time')
    })
})

describe('theirLocalTimeText', () => {
    it('reads their hour as the reader writes hours', () => {
        const at = (utc: string) => new Date(`2026-11-12T${utc}:40:00Z`)
        expect(theirLocalTimeText(9, at('18'))).toBe('3 AM there')
        expect(theirLocalTimeText(-8, at('20'))).toBe('12 PM there')
        expect(theirLocalTimeText(0, at('00'))).toBe('12 AM there')
        expect(theirLocalTimeText(-5, at('02'))).toBe('9 PM there')
    })
})
