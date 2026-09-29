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

const PURPLE = Color.Purple

/** R-1.8, R-1.9 — 24 warbands of the Chancellor's colour and 14 per Exile. */
function fullTable() {
    return testState(
        [
            testPlayer({
                playerId: 'chancellor',
                color: Color.Purple,
                warbandsOnBoard: { [PURPLE]: 3 },
                warbandsInPersonalBank: { [PURPLE]: 19 }
            }),
            testPlayer({
                playerId: 'exile',
                color: Color.Red,
                warbandsOnBoard: { [Color.Red]: 3 },
                warbandsInPersonalBank: { [Color.Red]: 10 }
            })
        ],
        {
            warbandsBySite: {
                c1: { [PURPLE]: 2, [Color.Red]: 1 },
                p1: { [Color.Red]: 0 }
            }
        }
    )
}

describe('the warband census', () => {
    it('counts every location a warband can be in', () => {
        const census = warbandCensus(fullTable())

        expect(census[PURPLE]).toBe(24)
        expect(census[Color.Red]).toBe(14)
    })

    it('counts the warbands standing on a card (Obsidian Cage, False Prophet)', () => {
        const state = fullTable()
        state.warbandsOnCards = {
            'relic.obsidian-cage': { [PURPLE]: 2, [Color.Red]: 1 },
            'vision.faith': { [Color.Red]: 1 }
        }

        const census = warbandCensus(state)
        expect(census[PURPLE]).toBe(26)
        expect(census[Color.Red]).toBe(16)
    })

    it('keeps colours apart rather than totalling them', () => {
        const census = warbandCensus(fullTable())
        expect(Object.keys(census).sort()).toEqual([Color.Red, PURPLE].sort())
    })

    it('totals a single record', () => {
        expect(totalWarbands({ [PURPLE]: 3, [Color.Red]: 4 })).toBe(7)
        expect(totalWarbands({})).toBe(0)
    })
})

describe('conservation (R-1.8, R-1.9, R-10.13)', () => {
    it('sees nothing when warbands only move', () => {
        const state = fullTable()
        expect(() =>
            expectWarbandsConserved(state, () => {
                const p = state.getPlayerState('exile')
                adjustCount(p.warbandsInPersonalBank, Color.Red, -2)
                adjustCount(p.warbandsOnBoard, Color.Red, 2)
            })
        ).not.toThrow()
    })

    it('catches a warband minted from nowhere', () => {
        const state = fullTable()
        expect(() =>
            expectWarbandsConserved(state, () => {
                adjustCount(state.getPlayerState('exile').warbandsOnBoard, Color.Red, 2)
            })
        ).toThrow(/red: 14 -> 16/)
    })

    it('catches a warband dropped on the floor', () => {
        const state = fullTable()
        expect(() =>
            expectWarbandsConserved(state, () => {
                adjustCount(state.warbandsBySite['c1'], PURPLE, -2)
            })
        ).toThrow(/purple: 24 -> 22/)
    })

    it('catches a colour swap that mints one colour and loses another', () => {
        // R-6.6.2 — a Citizen conversion replaces an Exile's warbands with purple.
        const state = fullTable()
        expect(() =>
            expectWarbandsConserved(state, () => {
                state.getPlayerState('exile').warbandsOnBoard[PURPLE] = 3
            })
        ).toThrow(/purple: 24 -> 27/)
    })

    it('names every colour that moved, not just the first', () => {
        const breaches = warbandConservationBreaches(
            { purple: 24, red: 14 },
            { purple: 23, red: 15 }
        )
        expect(breaches).toEqual([
            { color: 'purple', before: 24, after: 23 },
            { color: 'red', before: 14, after: 15 }
        ])
    })

    it('sees nothing when a warband moves from a board onto a card and is killed from it', () => {
        const state = fullTable()
        expect(() =>
            expectWarbandsConserved(state, () => {
                removeWarbandsFrom(state, { kind: 'board', playerId: 'exile' }, Color.Red, 2)
                addWarbandsToCard(state, 'relic.obsidian-cage', Color.Red, 2)
                removeWarbandsFromCard(state, 'relic.obsidian-cage', Color.Red, 1)
                killWarbands(state, Color.Red, 1)
            })
        ).not.toThrow()
        expect(state.warbandsOnCard('relic.obsidian-cage')).toEqual({ [Color.Red]: 1 })
    })

    it('catches a warband that leaves a board for a card and never arrives', () => {
        const state = fullTable()
        expect(() =>
            expectWarbandsConserved(state, () => {
                removeWarbandsFrom(state, { kind: 'board', playerId: 'exile' }, Color.Red, 1)
            })
        ).toThrow(/red: 14 -> 13/)
    })

    it('holds across a real action', () => {
        const state = testState(
            [
                testPlayer({
                    siteId: 'c1',
                    favor: 2,
                    warbandsOnBoard: { [Color.Red]: 3 },
                    warbandsInPersonalBank: { [Color.Red]: 11 }
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

        expect(warbandCensus(state)[Color.Red]).toBe(14)
    })
})
