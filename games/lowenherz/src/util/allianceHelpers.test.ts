import { describe, expect, it } from 'vitest'
import { areRegionsAllied } from './allianceHelpers.js'

describe('areRegionsAllied', () => {
    it('is true when an alliance links the two region ids, in either order', () => {
        const alliances = [{ id: 'a1', regionAId: 'own', regionBId: 'enemy' }]

        expect(areRegionsAllied(alliances, 'own', 'enemy')).toBe(true)
        expect(areRegionsAllied(alliances, 'enemy', 'own')).toBe(true)
    })

    it('is false when no alliance links the two region ids', () => {
        const alliances = [{ id: 'a1', regionAId: 'own', regionBId: 'enemy' }]

        expect(areRegionsAllied(alliances, 'own', 'someone-else')).toBe(false)
        expect(areRegionsAllied(alliances, 'unrelated-a', 'unrelated-b')).toBe(false)
    })

    it('is false with no alliances at all', () => {
        expect(areRegionsAllied([], 'own', 'enemy')).toBe(false)
    })
})
