import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { testPlayer, testState } from '../testing/fixture.js'
import { HydratedSetupChoice, SetupChoice } from './setupChoice.js'
import { PlayerStatus, Region } from '../model/oathEnums.js'
import { HydratedOathGameState } from '../model/gameState.js'
import {
    applySetupChoice,
    isSetupComplete,
    nextSetupPlayerId,
    reasonCannotSetupChoice
} from '../model/setup.js'
import { TOP_CRADLE_SLOT, allMapSlots } from '../data/mapSlots.js'
import { buildAction } from '../testing/actions.js'

/** R-1.23.1 to R-1.23.3 — the pawn is placed first, so R-10.5 discards from where it now stands. */
const CRADLE_TOP = TOP_CRADLE_SLOT
const PROVINCES_TOP = allMapSlots()[Region.Provinces][0]
const HINTERLAND_TOP = allMapSlots()[Region.Hinterland][0]

function board(handOverrides: Record<string, string[]> = {}): HydratedOathGameState {
    const hands = {
        chancellor: ['denizen.order.a', 'denizen.order.b', 'denizen.order.c'],
        exile: ['denizen.hearth.d', 'denizen.hearth.e', 'denizen.hearth.f'],
        ...handOverrides
    }
    return testState(
        [
            testPlayer({
                playerId: 'chancellor',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                handIds: hands.chancellor
            }),
            testPlayer({
                playerId: 'exile',
                color: Color.Red,
                status: PlayerStatus.Exile,
                handIds: hands.exile
            })
        ],
        {
            map: allMapSlots(),
            // R-8.3.5.7 — the top site of each region is faceup.
            siteCards: {
                [CRADLE_TOP]: 'site.the-tribunal',
                [PROVINCES_TOP]: 'site.marshes',
                [HINTERLAND_TOP]: 'site.mine'
            }
        }
    )
}

describe('R-X.3(b) — a resolved setup choice is non-undoable', () => {
    it('sets revealsInfo: its two discards are replayed into the vault', () => {
        // The vault is never rolled back, so an undone and re-resolved choice would discard twice.
        const state = board()
        const action = new HydratedSetupChoice(
            buildAction(SetupChoice, {
                playerId: 'chancellor',
                siteId: CRADLE_TOP,
                adviserCardId: 'denizen.order.a',
                discardOrder: ['denizen.order.b', 'denizen.order.c']
            })
        )
        action.apply(state)
        expect(action.revealsInfo).toBe(true)
    })
})

describe('R-1.23 — per player, in turn order', () => {
    it('R-1.23 — the Chancellor resolves first', () => {
        const state = board()
        expect(nextSetupPlayerId(state)).toBe('chancellor')
        expect(isSetupComplete(state)).toBe(false)
    })

    it('R-1.23 — a later player cannot jump the queue', () => {
        const state = board()
        expect(
            reasonCannotSetupChoice(state, 'exile', {
                siteId: PROVINCES_TOP,
                adviserCardId: 'denizen.hearth.d',
                discardOrder: ['denizen.hearth.e', 'denizen.hearth.f']
            })
        ).toMatch(/turn order/)
    })

    it('R-1.23.1 — the Chancellor must take the top Cradle site', () => {
        const state = board()
        expect(
            reasonCannotSetupChoice(state, 'chancellor', {
                siteId: PROVINCES_TOP,
                adviserCardId: 'denizen.order.a',
                discardOrder: ['denizen.order.b', 'denizen.order.c']
            })
        ).toMatch(/top Cradle site/)
    })

    it('R-1.23.1 — any faceup site is legal for an Exile', () => {
        const state = board()
        applySetupChoice(state, 'chancellor', {
            siteId: CRADLE_TOP,
            adviserCardId: 'denizen.order.a',
            discardOrder: ['denizen.order.b', 'denizen.order.c']
        })
        for (const siteId of [CRADLE_TOP, PROVINCES_TOP, HINTERLAND_TOP]) {
            expect(
                reasonCannotSetupChoice(state, 'exile', {
                    siteId,
                    adviserCardId: 'denizen.hearth.d',
                    discardOrder: ['denizen.hearth.e', 'denizen.hearth.f']
                })
            ).toBeUndefined()
        }
    })

    it('R-1.23.1, R-9.4 — a facedown site is not a legal pawn placement', () => {
        const state = board()
        const facedown = state.map[Region.Cradle][1]
        expect(
            reasonCannotSetupChoice(state, 'chancellor', {
                siteId: facedown,
                adviserCardId: 'denizen.order.a',
                discardOrder: ['denizen.order.b', 'denizen.order.c']
            })
        ).toMatch(/facedown/)
    })

    it('R-1.23.2, R-1.23.3 — the choice must account for exactly the cards drawn', () => {
        const state = board()
        const base = { siteId: CRADLE_TOP, adviserCardId: 'denizen.order.a' }
        expect(
            reasonCannotSetupChoice(state, 'chancellor', {
                ...base,
                discardOrder: ['denizen.order.b']
            })
        ).toMatch(/exactly the 3 cards/)
        expect(
            reasonCannotSetupChoice(state, 'chancellor', {
                ...base,
                discardOrder: ['denizen.order.b', 'denizen.order.zzz']
            })
        ).toMatch(/exactly the 3 cards/)
        expect(
            reasonCannotSetupChoice(state, 'chancellor', {
                ...base,
                discardOrder: ['denizen.order.a', 'denizen.order.b']
            })
        ).toBeDefined()
    })

    it('R-1.23.2 — the kept card becomes a FACEDOWN adviser', () => {
        const state = board()
        applySetupChoice(state, 'chancellor', {
            siteId: CRADLE_TOP,
            adviserCardId: 'denizen.order.a',
            discardOrder: ['denizen.order.b', 'denizen.order.c']
        })
        const player = state.getPlayerState('chancellor')
        expect(player.knownAdvisers()).toEqual([{ cardId: 'denizen.order.a', faceUp: false }])
        expect(player.advisers).toEqual([{ faceUp: false }])
        expect(player.handIds).toEqual([])
    })

    it('R-1.23.1 before R-1.23.3 — a Cradle pawn discards to the PROVINCES pile', () => {
        const state = board()
        const result = applySetupChoice(state, 'chancellor', {
            siteId: CRADLE_TOP,
            adviserCardId: 'denizen.order.a',
            discardOrder: ['denizen.order.b', 'denizen.order.c']
        })
        expect(result.discardPileRegion).toBe(Region.Provinces)
        expect(state.discardPileCounts[Region.Provinces]).toBe(2)
        expect(state.discardPileCounts[Region.Cradle]).toBe(0)
    })

    it('R-10.5 — a Provinces pawn discards to Hinterland, a Hinterland pawn to Cradle', () => {
        const state = board()
        applySetupChoice(state, 'chancellor', {
            siteId: CRADLE_TOP,
            adviserCardId: 'denizen.order.a',
            discardOrder: ['denizen.order.b', 'denizen.order.c']
        })
        const result = applySetupChoice(state, 'exile', {
            siteId: HINTERLAND_TOP,
            adviserCardId: 'denizen.hearth.d',
            discardOrder: ['denizen.hearth.e', 'denizen.hearth.f']
        })
        expect(result.discardPileRegion).toBe(Region.Cradle)
        expect(state.discardPileCounts[Region.Cradle]).toBe(2)
    })

    it('R-10.5, R-10.6 — the discard order is recorded, last card on top', () => {
        const state = board()
        const result = applySetupChoice(state, 'chancellor', {
            siteId: CRADLE_TOP,
            adviserCardId: 'denizen.order.a',
            discardOrder: ['denizen.order.c', 'denizen.order.b']
        })
        expect(result.discardedCardIds).toEqual(['denizen.order.c', 'denizen.order.b'])
    })

    it('R-1.23 — setup is complete once every pawn is placed and no hand remains', () => {
        const state = board()
        applySetupChoice(state, 'chancellor', {
            siteId: CRADLE_TOP,
            adviserCardId: 'denizen.order.a',
            discardOrder: ['denizen.order.b', 'denizen.order.c']
        })
        expect(isSetupComplete(state)).toBe(false)
        expect(nextSetupPlayerId(state)).toBe('exile')

        applySetupChoice(state, 'exile', {
            siteId: PROVINCES_TOP,
            adviserCardId: 'denizen.hearth.d',
            discardOrder: ['denizen.hearth.e', 'denizen.hearth.f']
        })
        expect(isSetupComplete(state)).toBe(true)
        expect(nextSetupPlayerId(state)).toBeUndefined()
    })

    it('R-1.23 — a player cannot resolve setup twice', () => {
        const state = board()
        applySetupChoice(state, 'chancellor', {
            siteId: CRADLE_TOP,
            adviserCardId: 'denizen.order.a',
            discardOrder: ['denizen.order.b', 'denizen.order.c']
        })
        expect(() =>
            applySetupChoice(state, 'chancellor', {
                siteId: CRADLE_TOP,
                adviserCardId: 'denizen.order.a',
                discardOrder: ['denizen.order.b', 'denizen.order.c']
            })
        ).toThrow(/already resolved/)
    })
})

describe('R-1.16 — the Chancellor places favor the bank cannot cover', () => {
    const FARM = 'site.fertile-valley'
    const PLAINS = 'site.plains'
    function short(): HydratedOathGameState {
        const state = board()
        state.favorSupply = 3
        state.pendingSiteFavor = [
            { siteCardId: FARM, wanted: 2 },
            { siteCardId: PLAINS, wanted: 2 }
        ]
        return state
    }
    const choice = {
        siteId: CRADLE_TOP,
        adviserCardId: 'denizen.order.a',
        discardOrder: ['denizen.order.b', 'denizen.order.c']
    }

    it('asks the Chancellor for the split, all of the bank, no site above its print', () => {
        const state = short()
        expect(reasonCannotSetupChoice(state, 'chancellor', choice)).toMatch(/Chancellor chooses how to place it/)
        expect(reasonCannotSetupChoice(state, 'chancellor', { ...choice, siteFavor: [{ siteCardId: FARM, favor: 3 }] })).toMatch(/between 0 and 2/)
        expect(reasonCannotSetupChoice(state, 'chancellor', { ...choice, siteFavor: [{ siteCardId: FARM, favor: 1 }, { siteCardId: PLAINS, favor: 1 }] })).toMatch(/all 3 favor/)
    })

    it('places the split and clears the wait', () => {
        const state = short()
        applySetupChoice(state, 'chancellor', { ...choice, siteFavor: [{ siteCardId: FARM, favor: 1 }, { siteCardId: PLAINS, favor: 2 }] })
        expect(state.tokensOn(FARM).favor).toBe(1)
        expect(state.tokensOn(PLAINS).favor).toBe(2)
        expect(state.favorSupply).toBe(0)
        expect(state.pendingSiteFavor).toBeUndefined()
    })

    it('an Exile never splits, and nobody splits a bank that covers every site', () => {
        expect(reasonCannotSetupChoice(board(), 'chancellor', { ...choice, siteFavor: [] })).toMatch(/only the Chancellor/)
    })
})
