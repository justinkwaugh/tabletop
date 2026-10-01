import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { PlayerStatus } from '../model/oathEnums.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
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
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: 3 },
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 19 }
            }),
            testPlayer({
                playerId: CITIZEN,
                color: Color.Blue,
                status: PlayerStatus.Citizen,
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: 2 },
                warbandsInPersonalBank: { [CITIZEN]: 14 }
            }),
            testPlayer({
                playerId: EXILE,
                color: Color.Red,
                status: PlayerStatus.Exile,
                warbandsOnBoard: { [EXILE]: 4 },
                warbandsInPersonalBank: { [EXILE]: 8 }
            })
        ],
        {
            chancellorPlayerId: CHANCELLOR,
            warbandsBySite: { c1: { [EXILE]: 2 }, p1: { [IMPERIAL_WARBANDS]: 1 } },
            ...overrides
        }
    )
}

describe('Kill (R-10.13)', () => {
    it('returns a warband to its owner\'s bank, whatever colour that player now shows', () => {
        const state = testState([
            testPlayer({ playerId: 'p1', color: Color.Red }),
            testPlayer({ playerId: 'p2', color: Color.Blue })
        ])
        state.getPlayerState('p1').color = Color.Blue
        state.getPlayerState('p2').color = Color.Red
        killWarbands(state, 'p1', 2)
        expect(state.getPlayerState('p1').warbandsInPersonalBank['p1']).toBe(16)
        expect(state.getPlayerState('p2').warbandsInPersonalBank['p2']).toBe(14)
    })

    it('returns a warband to the personal bank of the player whose warband it is', () => {
        const state = table()
        // Kill is only the arrival half, so a conserved kill pairs it with a removal.
        expectWarbandsConserved(state, () => {
            removeWarbandsFrom(state, { kind: 'board', playerId: EXILE }, EXILE, 2)
            killWarbands(state, EXILE, 2)
        })
        expect(state.getPlayerState(EXILE).warbandsOnBoard[EXILE]).toBe(2)
        expect(state.getPlayerState(EXILE).warbandsInPersonalBank[EXILE]).toBe(10)
    })

    it('sends Imperial warbands to the Chancellor, not to the Citizen holding them', () => {
        const state = table()
        expectWarbandsConserved(state, () => {
            removeWarbandsFrom(state, { kind: 'board', playerId: CITIZEN }, IMPERIAL_WARBANDS, 2)
            killWarbands(state, IMPERIAL_WARBANDS, 2)
        })
        expect(state.getPlayerState(CHANCELLOR).warbandsInPersonalBank[IMPERIAL_WARBANDS]).toBe(21)
        expect(
            state.getPlayerState(CITIZEN).warbandsInPersonalBank[IMPERIAL_WARBANDS] ?? 0
        ).toBe(0)
    })

    it('does not remove the warband from wherever it was -- callers do that', () => {
        const state = table()
        killWarbands(state, EXILE, 1)
        expect(state.getPlayerState(EXILE).warbandsOnBoard[EXILE]).toBe(4)
    })

    it('killing nothing does nothing', () => {
        const state = table()
        expectWarbandsConserved(state, () => killWarbands(state, EXILE, 0))
        expect(state.getPlayerState(EXILE).warbandsInPersonalBank[EXILE]).toBe(8)
    })

    it('refuses an owner who is no player, since every warband in play belongs to one', () => {
        const state = table()
        expect(() => killWarbands(state, 'nobody', 1)).toThrow('Player state for player nobody not found')
    })
})

describe('moving warbands between locations', () => {
    it('takes warbands off a site', () => {
        const state = table()
        removeWarbandsFrom(state, { kind: 'site', siteId: 'c1' }, EXILE, 2)
        expect(state.warbandsBySite['c1'][EXILE]).toBe(0)
    })

    it('takes warbands off a board', () => {
        const state = table()
        removeWarbandsFrom(state, { kind: 'board', playerId: EXILE }, EXILE, 3)
        expect(state.getPlayerState(EXILE).warbandsOnBoard[EXILE]).toBe(1)
    })

    it('refuses to take more than are there', () => {
        const state = table()
        expect(() =>
            removeWarbandsFrom(state, { kind: 'site', siteId: 'c1' }, EXILE, 3)
        ).toThrow(/only 2/)
    })

    it('adds to a board, creating the owner\'s entry if needed', () => {
        const state = table()
        addWarbandsToBoard(state, CITIZEN, CITIZEN, 2)
        expect(state.getPlayerState(CITIZEN).warbandsOnBoard[CITIZEN]).toBe(2)
    })

    it('puts warbands on a card and takes them off, refusing more than are there', () => {
        const state = table()
        addWarbandsToCard(state, 'relic.obsidian-cage', CITIZEN, 2)
        addWarbandsToCard(state, 'relic.obsidian-cage', CITIZEN, 1)
        expect(state.warbandsOnCard('relic.obsidian-cage')).toEqual({ [CITIZEN]: 3 })
        removeWarbandsFromCard(state, 'relic.obsidian-cage', CITIZEN, 2)
        expect(state.warbandsOnCard('relic.obsidian-cage')).toEqual({ [CITIZEN]: 1 })
        expect(() =>
            removeWarbandsFromCard(state, 'relic.obsidian-cage', CITIZEN, 2)
        ).toThrow(/only 1 on it/)
        expect(() => removeWarbandsFromCard(state, 'vision.faith', CITIZEN, 1)).toThrow(
            /only 0 on it/
        )
    })

    it('reads a board total across owners', () => {
        expect(warbandsOnBoardOf(table(), CHANCELLOR)).toBe(3)
        expect(warbandsOnBoardOf(table(), EXILE)).toBe(4)
    })
})

describe('force totals (R-10.9)', () => {
    it('sums every group', () => {
        const force: WarbandGroup[] = [
            { at: { kind: 'board', playerId: EXILE }, owner: EXILE, count: 4 },
            { at: { kind: 'site', siteId: 'c1' }, owner: EXILE, count: 2 }
        ]
        expect(forceTotal(force)).toBe(6)
        expect(forceTotal([])).toBe(0)
    })
})

describe('validating a chosen selection against a force (R-5.5.6, R-5.5.6.a)', () => {
    const force: WarbandGroup[] = [
        { at: { kind: 'board', playerId: EXILE }, owner: EXILE, count: 4 },
        { at: { kind: 'site', siteId: 'c1' }, owner: EXILE, count: 2 }
    ]

    it('accepts a selection drawn from the force', () => {
        expect(
            selectionExceedsForce(
                [{ at: { kind: 'site', siteId: 'c1' }, owner: EXILE, count: 2 }],
                force
            )
        ).toBeUndefined()
    })

    it('rejects taking more from a group than the force holds there', () => {
        expect(
            selectionExceedsForce(
                [{ at: { kind: 'site', siteId: 'c1' }, owner: EXILE, count: 3 }],
                force
            )
        ).toMatch(/c1/)
    })

    it('rejects a location that is not in the force at all', () => {
        expect(
            selectionExceedsForce(
                [{ at: { kind: 'board', playerId: CHANCELLOR }, owner: IMPERIAL_WARBANDS, count: 1 }],
                force
            )
        ).toMatch(/not in the/)
    })

    it('adds up repeated entries for the same group', () => {
        expect(
            selectionExceedsForce(
                [
                    { at: { kind: 'site', siteId: 'c1' }, owner: EXILE, count: 1 },
                    { at: { kind: 'site', siteId: 'c1' }, owner: EXILE, count: 2 }
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
            { at: { kind: 'site', siteId: 'c1' }, owner: EXILE, count: 2 }
        ]
        expectWarbandsConserved(state, () => moveForceToBoards(state, force))

        expect(state.warbandsBySite['c1'][EXILE]).toBe(0)
        expect(state.getPlayerState(EXILE).warbandsOnBoard[EXILE]).toBe(6)
    })

    /** R-5.5.7.I */
    it('sends Imperial warbands off a site to the Chancellor, not to a defending Citizen', () => {
        const state = table()
        const force: WarbandGroup[] = [
            { at: { kind: 'site', siteId: 'p1' }, owner: IMPERIAL_WARBANDS, count: 1 }
        ]
        expectWarbandsConserved(state, () => moveForceToBoards(state, force))

        expect(state.getPlayerState(CHANCELLOR).warbandsOnBoard[IMPERIAL_WARBANDS]).toBe(4)
        expect(state.getPlayerState(CITIZEN).warbandsOnBoard[IMPERIAL_WARBANDS]).toBe(2)
    })

    it('leaves warbands already on a board where they are', () => {
        const state = table()
        const force: WarbandGroup[] = [
            { at: { kind: 'board', playerId: CITIZEN }, owner: IMPERIAL_WARBANDS, count: 2 }
        ]
        expectWarbandsConserved(state, () => moveForceToBoards(state, force))

        expect(state.getPlayerState(CITIZEN).warbandsOnBoard[IMPERIAL_WARBANDS]).toBe(2)
        expect(state.getPlayerState(CHANCELLOR).warbandsOnBoard[IMPERIAL_WARBANDS]).toBe(3)
    })
})
