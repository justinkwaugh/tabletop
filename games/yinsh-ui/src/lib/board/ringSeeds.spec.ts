import { describe, expect, it } from 'vitest'
import { pointFromName as p } from '@tabletop/yinsh'
import { markerSeed, removedRingSeed, ringSeed } from './ringSeeds.js'

describe('ringSeed', () => {
    it('follows the ring, not the point it stands on', () => {
        expect(ringSeed(4)).not.toBe(ringSeed(5))
    })
})

describe('markerSeed', () => {
    it('tells markers apart by their point', () => {
        expect(markerSeed(p('F3'))).not.toBe(markerSeed(p('F7')))
    })
})

describe('removedRingSeed', () => {
    it('gives a removed ring the specks it had on the board', () => {
        const player = { playerId: 'a', removedRingIds: [7, 2] }
        expect(removedRingSeed(player, 0)).toBe(ringSeed(7))
        expect(removedRingSeed(player, 1)).toBe(ringSeed(2))
    })

    it('tells apart the empty spaces', () => {
        const a = { playerId: 'a', removedRingIds: [] }
        expect(removedRingSeed(a, 0)).not.toBe(removedRingSeed(a, 1))
        expect(removedRingSeed(a, 0)).not.toBe(
            removedRingSeed({ playerId: 'b', removedRingIds: [] }, 0)
        )
    })
})
