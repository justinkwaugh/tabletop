import { describe, expect, it } from 'vitest'
import { nameListSeparator, winVerb } from './gameCallText.js'

describe('gameCallText', () => {
    it('joins names with commas and a final and', () => {
        expect([0, 1, 2].map((position) => nameListSeparator(position, 3))).toEqual([
            ', ',
            ' and ',
            ''
        ])
        expect(nameListSeparator(0, 1)).toBe('')
    })

    it('agrees the verb with the winner', () => {
        expect(winVerb('a', 'b')).toBe('wins')
        expect(winVerb('a', 'a')).toBe('win')
    })
})
