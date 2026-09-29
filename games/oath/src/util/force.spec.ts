import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { IMPERIAL_COLOR, PlayerStatus } from '../model/oathEnums.js'
import { testPlayer, testState } from '../testing/fixture.js'
import { expectWarbandsConserved } from '../testing/census.js'
import {
    addWarbandsToBoard,
    addWarbandsToCard,
    forceTotal,
    killWarbands,
    moveForceToBoards,
    removeWarbandsFrom,
    removeWarbandsFromCard,
    selectionExceedsForce,
    warbandsOnBoardOf
} from './force.js'
import type { WarbandGroup } from '../model/campaign.js'

const CHANCELLOR = 'chancellor'
const CITIZEN = 'citizen'
const EXILE = 'exile'

function table(overrides = {}) {
    return testState(
        [
            testPlayer({
                playerId: CHANCELLOR,
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                warbandsOnBoard: { [IMPERIAL_COLOR]: 3 },
                warbandsInPersonalBank: { [IMPERIAL_COLOR]: 19 }
            }),
            testPlayer({
                playerId: CITIZEN,
                color: Color.Blue,
                status: PlayerStatus.Citizen,
                warbandsOnBoard: { [IMPERIAL_COLOR]: 2 },
                warbandsInPersonalBank: { [Color.Blue]: 14 }
            }),
            testPlayer({
                playerId: EXILE,
                color: Color.Red,
                status: PlayerStatus.Exile,
                warbandsOnBoard: { [Color.Red]: 4 },
                warbandsInPersonalBank: { [Color.Red]: 8 }
            })
        ],
        {
            chancellorPlayerId: CHANCELLOR,
            warbandsBySite: { c1: { [Color.Red]: 2 }, p1: { [IMPERIAL_COLOR]: 1 } },
            ...overrides
        }
    )
}

describe('Kill (R-10.13)', () => {
    it('returns a warband to the seat recorded for its colour, whatever colour a player now shows', () => {
        const state = testState([
            testPlayer({ playerId: 'p1', color: Color.Red }),
            testPlayer({ playerId: 'p2', color: Color.Blue })
        ])
        state.getPlayerState('p1').color = Color.Yellow
        killWarbands(state, Color.Red, 2)
        expect(state.getPlayerState('p1').warbandsInPersonalBank[Color.Red]).toBe(16)
    })

    it('returns a warband to the personal bank of the player whose colour it is', () => {
        const state = table()
        // Kill is only the arrival half, so a conserved kill pairs it with a removal.
        expectWarbandsConserved(state, () => {
            removeWarbandsFrom(state, { kind: 'board', playerId: EXILE }, Color.Red, 2)
            killWarbands(state, Color.Red, 2)
        })
        expect(state.getPlayerState(EXILE).warbandsOnBoard[Color.Red]).toBe(2)
        expect(state.getPlayerState(EXILE).warbandsInPersonalBank[Color.Red]).toBe(10)
    })

    it('sends purple to the Chancellor, not to the Citizen holding it', () => {
        const state = table()
        expectWarbandsConserved(state, () => {
            removeWarbandsFrom(state, { kind: 'board', playerId: CITIZEN }, IMPERIAL_COLOR, 2)
            killWarbands(state, IMPERIAL_COLOR, 2)
        })
        expect(state.getPlayerState(CHANCELLOR).warbandsInPersonalBank[IMPERIAL_COLOR]).toBe(21)
        expect(
            state.getPlayerState(CITIZEN).warbandsInPersonalBank[IMPERIAL_COLOR] ?? 0
        ).toBe(0)
    })

    it('does not remove the warband from wherever it was -- callers do that', () => {
        const state = table()
        killWarbands(state, Color.Red, 1)
        expect(state.getPlayerState(EXILE).warbandsOnBoard[Color.Red]).toBe(4)
    })

    it('killing nothing does nothing', () => {
        const state = table()
        expectWarbandsConserved(state, () => killWarbands(state, Color.Red, 0))
        expect(state.getPlayerState(EXILE).warbandsInPersonalBank[Color.Red]).toBe(8)
    })

    it('refuses a colour no seat holds, since every colour in play belongs to one', () => {
        const state = table()
        expect(() => killWarbands(state, Color.Green, 1)).toThrow('no seat holds the green warbands')
    })
})

describe('moving warbands between locations', () => {
    it('takes warbands off a site', () => {
        const state = table()
        removeWarbandsFrom(state, { kind: 'site', siteId: 'c1' }, Color.Red, 2)
        expect(state.warbandsBySite['c1'][Color.Red]).toBe(0)
    })

    it('takes warbands off a board', () => {
        const state = table()
        removeWarbandsFrom(state, { kind: 'board', playerId: EXILE }, Color.Red, 3)
        expect(state.getPlayerState(EXILE).warbandsOnBoard[Color.Red]).toBe(1)
    })

    it('refuses to take more than are there', () => {
        const state = table()
        expect(() =>
            removeWarbandsFrom(state, { kind: 'site', siteId: 'c1' }, Color.Red, 3)
        ).toThrow(/only 2/)
    })

    it('adds to a board, creating the colour entry if needed', () => {
        const state = table()
        addWarbandsToBoard(state, CITIZEN, Color.Blue, 2)
        expect(state.getPlayerState(CITIZEN).warbandsOnBoard[Color.Blue]).toBe(2)
    })

    it('puts warbands on a card and takes them off, refusing more than are there', () => {
        const state = table()
        addWarbandsToCard(state, 'relic.obsidian-cage', Color.Blue, 2)
        addWarbandsToCard(state, 'relic.obsidian-cage', Color.Blue, 1)
        expect(state.warbandsOnCard('relic.obsidian-cage')).toEqual({ [Color.Blue]: 3 })
        removeWarbandsFromCard(state, 'relic.obsidian-cage', Color.Blue, 2)
        expect(state.warbandsOnCard('relic.obsidian-cage')).toEqual({ [Color.Blue]: 1 })
        expect(() =>
            removeWarbandsFromCard(state, 'relic.obsidian-cage', Color.Blue, 2)
        ).toThrow(/only 1 on it/)
        expect(() => removeWarbandsFromCard(state, 'vision.faith', Color.Blue, 1)).toThrow(
            /only 0 on it/
        )
    })

    it('reads a board total across colours', () => {
        expect(warbandsOnBoardOf(table(), CHANCELLOR)).toBe(3)
        expect(warbandsOnBoardOf(table(), EXILE)).toBe(4)
    })
})

describe('force totals (R-10.9)', () => {
    it('sums every group', () => {
        const force: WarbandGroup[] = [
            { at: { kind: 'board', playerId: EXILE }, color: Color.Red, count: 4 },
            { at: { kind: 'site', siteId: 'c1' }, color: Color.Red, count: 2 }
        ]
        expect(forceTotal(force)).toBe(6)
        expect(forceTotal([])).toBe(0)
    })
})

describe('validating a chosen selection against a force (R-5.5.6, R-5.5.6.a)', () => {
    const force: WarbandGroup[] = [
        { at: { kind: 'board', playerId: EXILE }, color: Color.Red, count: 4 },
        { at: { kind: 'site', siteId: 'c1' }, color: Color.Red, count: 2 }
    ]

    it('accepts a selection drawn from the force', () => {
        expect(
            selectionExceedsForce(
                [{ at: { kind: 'site', siteId: 'c1' }, color: Color.Red, count: 2 }],
                force
            )
        ).toBeUndefined()
    })

    it('rejects taking more from a group than the force holds there', () => {
        expect(
            selectionExceedsForce(
                [{ at: { kind: 'site', siteId: 'c1' }, color: Color.Red, count: 3 }],
                force
            )
        ).toMatch(/c1/)
    })

    it('rejects a location that is not in the force at all', () => {
        expect(
            selectionExceedsForce(
                [{ at: { kind: 'board', playerId: CHANCELLOR }, color: IMPERIAL_COLOR, count: 1 }],
                force
            )
        ).toMatch(/not in the/)
    })

    it('adds up repeated entries for the same group', () => {
        expect(
            selectionExceedsForce(
                [
                    { at: { kind: 'site', siteId: 'c1' }, color: Color.Red, count: 1 },
                    { at: { kind: 'site', siteId: 'c1' }, color: Color.Red, count: 2 }
                ],
                force
            )
        ).toMatch(/c1/)
    })
})

describe('moving a surviving force to boards (R-5.5.6)', () => {
    it('moves warbands at sites onto the owning board', () => {
        const state = table()
        const force: WarbandGroup[] = [
            { at: { kind: 'site', siteId: 'c1' }, color: Color.Red, count: 2 }
        ]
        expectWarbandsConserved(state, () => moveForceToBoards(state, force))

        expect(state.warbandsBySite['c1'][Color.Red]).toBe(0)
        expect(state.getPlayerState(EXILE).warbandsOnBoard[Color.Red]).toBe(6)
    })

    /** R-5.5.7.I */
    it('sends purple off a site to the Chancellor, not to a defending Citizen', () => {
        const state = table()
        const force: WarbandGroup[] = [
            { at: { kind: 'site', siteId: 'p1' }, color: IMPERIAL_COLOR, count: 1 }
        ]
        expectWarbandsConserved(state, () => moveForceToBoards(state, force))

        expect(state.getPlayerState(CHANCELLOR).warbandsOnBoard[IMPERIAL_COLOR]).toBe(4)
        expect(state.getPlayerState(CITIZEN).warbandsOnBoard[IMPERIAL_COLOR]).toBe(2)
    })

    it('leaves warbands already on a board where they are', () => {
        const state = table()
        const force: WarbandGroup[] = [
            { at: { kind: 'board', playerId: CITIZEN }, color: IMPERIAL_COLOR, count: 2 }
        ]
        expectWarbandsConserved(state, () => moveForceToBoards(state, force))

        expect(state.getPlayerState(CITIZEN).warbandsOnBoard[IMPERIAL_COLOR]).toBe(2)
        expect(state.getPlayerState(CHANCELLOR).warbandsOnBoard[IMPERIAL_COLOR]).toBe(3)
    })
})
