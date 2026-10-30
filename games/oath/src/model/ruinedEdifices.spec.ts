import { describe, expect, it } from 'vitest'
import { Suit } from '../model/oathEnums.js'
import {
    ANCIENT_FORGE,
    HALL_OF_DEBATE,
    PLAINS_SLOT,
    STONES_SLOT,
    WOLVES,
    edificeTable,
    placeEdifice,
    SPRAWLING_RAMPART
} from '../testing/edifices.js'
import { served } from '../testing/projection.js'

describe('an edifice in play: one card, two sides (R-2.9)', () => {
    it('knows an edifice by its kind', () => {
        const state = edificeTable()
        expect(state.isEdifice(HALL_OF_DEBATE)).toBe(true)
        expect(state.isEdifice(WOLVES)).toBe(false)
    })

    it('R-2.9, R-10.14 — an intact edifice shows its suit in play; a ruined one shows none', () => {
        const state = edificeTable()
        expect(state.isRuined(HALL_OF_DEBATE)).toBe(false)
        expect(state.suitInPlay(HALL_OF_DEBATE)).toBe(Suit.Hearth)
        expect(state.isRuined(ANCIENT_FORGE)).toBe(true)
        expect(state.suitInPlay(ANCIENT_FORGE)).toBeUndefined()
        expect(state.suitInPlay(WOLVES)).toBe(Suit.Beast)
    })

    it('flips a placed edifice either way, and leaves no key once none is ruined', () => {
        const state = edificeTable()
        state.setEdificeRuined(HALL_OF_DEBATE, true)
        expect(state.ruinedEdificeIds).toEqual([ANCIENT_FORGE, HALL_OF_DEBATE])
        state.setEdificeRuined(ANCIENT_FORGE, false)
        state.setEdificeRuined(HALL_OF_DEBATE, false)
        expect(state.suitInPlay(ANCIENT_FORGE)).toBe(Suit.Nomad)
        expect('ruinedEdificeIds' in state.dehydrate()).toBe(false)
    })

    it('refuses to flip a denizen, or an edifice at no site', () => {
        const state = edificeTable()
        expect(() => state.setEdificeRuined(WOLVES, true)).toThrow(/not an edifice/)
        expect(() => state.setEdificeRuined(SPRAWLING_RAMPART, true)).toThrow(/not at a site/)
    })

    it('R-2.8.1 — sits first in its site’s row, and a later card goes after it', () => {
        const state = edificeTable()
        expect(state.denizensAt(PLAINS_SLOT)).toEqual([HALL_OF_DEBATE, WOLVES])
        expect(state.denizensAt(STONES_SLOT)).toEqual([ANCIENT_FORGE])
    })

    it('one edifice per site, in a space of its own', () => {
        const state = edificeTable()
        expect(() => placeEdifice(state, PLAINS_SLOT, SPRAWLING_RAMPART)).toThrow(
            /already holds an edifice/
        )
        state.denizensBySite.c2 = ['denizen.order.wrestlers', 'denizen.order.longbows']
        expect(() => placeEdifice(state, 'c2', SPRAWLING_RAMPART)).toThrow(/no room/)
    })

    it('R-9.4 — which side is up is public: every seat is served it', () => {
        const state = edificeTable()
        expect(served(state, { kind: 'player', playerId: 'rhys' }).ruinedEdificeIds).toEqual([
            ANCIENT_FORGE
        ])
        expect(served(state).ruinedEdificeIds).toEqual([ANCIENT_FORGE])
    })
})
