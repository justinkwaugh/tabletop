import { describe, expect, it } from 'vitest'
import { Suit, CardKind } from '../model/oathEnums.js'
import { kindOf, suitOf } from './cardRegistry.js'
import { PLAYTEST_DECK, PLAYTEST_RELICS } from './playtestDeck.js'
import {
    composeFirstGameDeck,
    DENIZENS_PER_SUIT_IN_PLAY,
    reasonCuratedDeckInvalid,
    SetupVariant
} from './worldDeck.js'
import { buildInitialPublicState, buildSetupVault } from '../model/setup.js'
import { testPlayer, testState } from '../testing/fixture.js'
import { OathType } from '../model/oathEnums.js'
import { Color, getPrng } from '@tabletop/common'

/** R-9.4 protects the world deck's order, not its composition. */

function seededRandom(seed: number): () => number {
    // A tiny LCG is enough: the tests need two seeds to disagree, not quality.
    let x = seed >>> 0
    return () => {
        x = (x * 1664525 + 1013904223) >>> 0
        return x / 0x100000000
    }
}

describe('PLAYTEST_DECK — the pinned 54', () => {
    it('is a legal first-game deck: 54 registered denizens, 9 per suit, no repeats', () => {
        expect(reasonCuratedDeckInvalid(PLAYTEST_DECK)).toBeUndefined()
        expect(PLAYTEST_DECK).toHaveLength(DENIZENS_PER_SUIT_IN_PLAY * 6)
        for (const suit of Object.values(Suit)) {
            expect(PLAYTEST_DECK.filter((id) => suitOf(id) === suit)).toHaveLength(
                DENIZENS_PER_SUIT_IN_PLAY
            )
        }
    })

    it('names only relics for PLAYTEST_RELICS', () => {
        for (const id of PLAYTEST_RELICS) {
            expect(kindOf(id)).toBe(CardKind.Relic)
        }
    })
})

describe('reasonCuratedDeckInvalid — refuses what would silently shrink the deck', () => {
    it('a duplicate', () => {
        const dupe = [...PLAYTEST_DECK]
        dupe[1] = dupe[0]
        expect(reasonCuratedDeckInvalid(dupe)).toMatch(/appears twice/)
    })

    it('a card that is not a denizen', () => {
        const bad = [...PLAYTEST_DECK]
        bad[0] = 'relic.map'
        expect(reasonCuratedDeckInvalid(bad)).toMatch(/not a registered denizen/)
    })

    it('an unregistered id', () => {
        const bad = [...PLAYTEST_DECK]
        bad[0] = 'denizen.hearth.no-such-card'
        expect(reasonCuratedDeckInvalid(bad)).toMatch(/not a registered denizen/)
    })

    it('a suit short by one', () => {
        expect(reasonCuratedDeckInvalid(PLAYTEST_DECK.slice(1))).toMatch(/needs 9/)
    })
})

describe('composeFirstGameDeck with a curated pool', () => {
    it('puts exactly the 54 in play', () => {
        const worldDeck = composeFirstGameDeck(seededRandom(1), PLAYTEST_DECK)
        const denizensInDeck = worldDeck.filter((id) => kindOf(id) === CardKind.Denizen)
        expect(new Set(denizensInDeck)).toEqual(new Set(PLAYTEST_DECK))
        expect(denizensInDeck).toHaveLength(54)
    })

    it('still draws the ORDER from the seed — composition is public, order is not', () => {
        const a = composeFirstGameDeck(seededRandom(1), PLAYTEST_DECK)
        const b = composeFirstGameDeck(seededRandom(2), PLAYTEST_DECK)
        expect(new Set(a)).toEqual(new Set(b))
        expect(a).not.toEqual(b)
        expect(composeFirstGameDeck(seededRandom(1), PLAYTEST_DECK)).toEqual(a)
    })

    it('throws on an illegal pool instead of dealing a smaller deck', () => {
        expect(() => composeFirstGameDeck(seededRandom(1), PLAYTEST_DECK.slice(1))).toThrow(
            /Curated first-game deck is not legal/
        )
    })

    it('with no pool, composes at random as before (Randomized unchanged)', () => {
        const worldDeck = composeFirstGameDeck(seededRandom(1))
        expect(worldDeck.filter((id) => kindOf(id) === CardKind.Denizen)).toHaveLength(54)
    })
})

describe('SetupVariant.Curated through the real setup build', () => {
    function curatedSetup() {
        const players = [
            testPlayer({ playerId: 'p1', color: Color.Purple }),
            testPlayer({ playerId: 'p2', color: Color.Red })
        ]
        const state = testState(players)
        buildInitialPublicState(state, {
            oathType: OathType.Supremacy,
            turnOrder: ['p1', 'p2'],
            random: seededRandom(7),
            setupVariant: SetupVariant.Curated
        })
        return state
    }

    it('the VARIANT rides public state (never the ids), and the vault deals only from the pool', () => {
        const state = curatedSetup()
        expect(state.setupVariant).toBe(SetupVariant.Curated)
        // R-9.4
        expect(JSON.stringify(state.dehydrate())).not.toContain('denizen.hearth.wayside-inn')

        const vault = buildSetupVault(state, getPrng(3))
        const denizens = vault.worldDeck.filter((id) => kindOf(id) === CardKind.Denizen)
        expect(new Set(denizens)).toEqual(new Set(PLAYTEST_DECK))
    })
})
