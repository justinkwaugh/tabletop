import { describe, expect, it } from 'vitest'
import { pointFromName as p } from '@tabletop/yinsh'
import { removedRingSeed, ringSeed } from './ringSeeds.js'

describe('ringSeed', () => {
    it('follows the ring, not the point it stands on', () => {
        expect(ringSeed(4, p('F3'))).toBe(ringSeed(4, p('F7')))
        expect(ringSeed(4, p('F3'))).not.toBe(ringSeed(5, p('F3')))
    })

    it('falls back to the point in a game saved without ids', () => {
        expect(ringSeed(undefined, p('F3'))).not.toBe(ringSeed(undefined, p('F7')))
    })
})

describe('removedRingSeed', () => {
    it('gives a removed ring the specks it had on the board', () => {
        const player = { playerId: 'a', removedRingIds: [7, 2] }
        expect(removedRingSeed(player, 0)).toBe(ringSeed(7, p('F3')))
        expect(removedRingSeed(player, 1)).toBe(ringSeed(2, p('B2')))
    })

    it('tells apart the spaces of a game saved without ids', () => {
        const a = { playerId: 'a' }
        expect(removedRingSeed(a, 0)).not.toBe(removedRingSeed(a, 1))
        expect(removedRingSeed(a, 0)).not.toBe(removedRingSeed({ playerId: 'b' }, 0))
    })
})
