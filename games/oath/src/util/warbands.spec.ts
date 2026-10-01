import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { adjustCount, totalWarbands } from './warbands.js'
import { expectWarbandsConserved, warbandCensus, warbandConservationBreaches } from '../testing/census.js'
import {
    addWarbandsToCard,
    killWarbands,
    removeWarbandsFrom,
    removeWarbandsFromCard
} from './force.js'
import { HydratedMuster, Muster } from '../actions/muster.js'
import { testPlayer, testState } from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'

/** R-1.8, R-1.9 — 24 Imperial warbands and 14 per Exile. */
function fullTable() {
    return testState(
        [
            testPlayer({
                playerId: 'chancellor',
                color: Color.Purple,
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: 3 },
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 19 }
            }),
            testPlayer({
                playerId: 'exile',
                color: Color.Red,
                warbandsOnBoard: { exile: 3 },
                warbandsInPersonalBank: { exile: 10 }
            })
        ],
        {
            warbandsBySite: {
                c1: { [IMPERIAL_WARBANDS]: 2, exile: 1 },
                p1: { exile: 0 }
            }
        }
    )
}

describe('the warband census', () => {
    it('counts every location a warband can be in', () => {
        const census = warbandCensus(fullTable())

        expect(census[IMPERIAL_WARBANDS]).toBe(24)
        expect(census['exile']).toBe(14)
    })

    it('counts the warbands standing on a card (Obsidian Cage, False Prophet)', () => {
        const state = fullTable()
        state.warbandsOnCards = {
            'relic.obsidian-cage': { [IMPERIAL_WARBANDS]: 2, exile: 1 },
            'vision.faith': { exile: 1 }
        }

        const census = warbandCensus(state)
        expect(census[IMPERIAL_WARBANDS]).toBe(26)
        expect(census['exile']).toBe(16)
    })

    it('keeps owners apart rather than totalling them', () => {
        const census = warbandCensus(fullTable())
        expect(Object.keys(census).sort()).toEqual(['exile', IMPERIAL_WARBANDS].sort())
    })

    it('totals a single record', () => {
        expect(totalWarbands({ [IMPERIAL_WARBANDS]: 3, exile: 4 })).toBe(7)
        expect(totalWarbands({})).toBe(0)
    })
})

describe('conservation (R-1.8, R-1.9, R-10.13)', () => {
    it('sees nothing when warbands only move', () => {
        const state = fullTable()
        expect(() =>
            expectWarbandsConserved(state, () => {
                const p = state.getPlayerState('exile')
                adjustCount(p.warbandsInPersonalBank, 'exile', -2)
                adjustCount(p.warbandsOnBoard, 'exile', 2)
            })
        ).not.toThrow()
    })

    it('catches a warband minted from nowhere', () => {
        const state = fullTable()
        expect(() =>
            expectWarbandsConserved(state, () => {
                adjustCount(state.getPlayerState('exile').warbandsOnBoard, 'exile', 2)
            })
        ).toThrow(/exile: 14 -> 16/)
    })

    it('catches a warband dropped on the floor', () => {
        const state = fullTable()
        expect(() =>
            expectWarbandsConserved(state, () => {
                adjustCount(state.warbandsBySite['c1'], IMPERIAL_WARBANDS, -2)
            })
        ).toThrow(/imperial: 24 -> 22/)
    })

    it('catches a swap that mints one owner\'s warbands and loses another\'s', () => {
        // R-6.6.2 — a Citizen conversion replaces an Exile's warbands with Imperial ones.
        const state = fullTable()
        expect(() =>
            expectWarbandsConserved(state, () => {
                state.getPlayerState('exile').warbandsOnBoard[IMPERIAL_WARBANDS] = 3
            })
        ).toThrow(/imperial: 24 -> 27/)
    })

    it('names every owner whose warbands moved, not just the first', () => {
        const breaches = warbandConservationBreaches(
            { [IMPERIAL_WARBANDS]: 24, exile: 14 },
            { [IMPERIAL_WARBANDS]: 23, exile: 15 }
        )
        expect(breaches).toEqual([
            { owner: IMPERIAL_WARBANDS, before: 24, after: 23 },
            { owner: 'exile', before: 14, after: 15 }
        ])
    })

    it('sees nothing when a warband moves from a board onto a card and is killed from it', () => {
        const state = fullTable()
        expect(() =>
            expectWarbandsConserved(state, () => {
                removeWarbandsFrom(state, { kind: 'board', playerId: 'exile' }, 'exile', 2)
                addWarbandsToCard(state, 'relic.obsidian-cage', 'exile', 2)
                removeWarbandsFromCard(state, 'relic.obsidian-cage', 'exile', 1)
                killWarbands(state, 'exile', 1)
            })
        ).not.toThrow()
        expect(state.warbandsOnCard('relic.obsidian-cage')).toEqual({ exile: 1 })
    })

    it('catches a warband that leaves a board for a card and never arrives', () => {
        const state = fullTable()
        expect(() =>
            expectWarbandsConserved(state, () => {
                removeWarbandsFrom(state, { kind: 'board', playerId: 'exile' }, 'exile', 1)
            })
        ).toThrow(/exile: 14 -> 13/)
    })

    it('holds across a real action', () => {
        const state = testState(
            [
                testPlayer({
                    siteId: 'c1',
                    favor: 2,
                    warbandsOnBoard: { p1: 3 },
                    warbandsInPersonalBank: { p1: 11 }
                })
            ],
            { denizensBySite: { c1: ['card-a'] } }
        )

        expect(() =>
            expectWarbandsConserved(state, () => {
                new HydratedMuster(
                    buildAction(Muster, { playerId: 'p1', cardId: 'card-a' })
                ).apply(state)
            })
        ).not.toThrow()

        expect(warbandCensus(state)['p1']).toBe(14)
    })
})
