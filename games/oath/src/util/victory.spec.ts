import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { Banner, OathType, PlayerStatus } from '../model/oathEnums.js'
import { testBanners } from '../testing/fixture.js'
import { GRAND_SCEPTER_ID } from '../data/relics.js'
import {
    WinKind,
    endDieIsRolled,
    endDieThreshold,
    stableRegimeWinner,
    wakePhaseWin,
    warExhaustionWinner
} from './victory.js'
import { CHANCELLOR, CITIZEN, EXILE, OTHER_EXILE, statusTable } from '../testing/tables.js'

const CUP = 'relic.cup'
const CROWN = 'relic.crown'

describe('the end die is rolled only in rounds five to seven (R-3.3)', () => {
    it('has a different threshold each round, and none outside them', () => {
        expect(endDieThreshold(4)).toBeUndefined()
        expect(endDieThreshold(5)).toBe(6)
        expect(endDieThreshold(6)).toBe(5)
        expect(endDieThreshold(7)).toBe(3)
        // R-3.4 ends the eighth automatically — no die.
        expect(endDieThreshold(8)).toBeUndefined()
    })

    it('rolls only if the Empire holds the title (R-3.3)', () => {
        const empire = statusTable({ round: 5, oathkeeperPlayerId: CHANCELLOR })
        expect(endDieIsRolled(empire)).toBe(true)

        const citizen = statusTable({ round: 6, oathkeeperPlayerId: CITIZEN })
        expect(endDieIsRolled(citizen)).toBe(true)

        const exile = statusTable({ round: 7, oathkeeperPlayerId: EXILE })
        expect(endDieIsRolled(exile)).toBe(false)

        const unheld = statusTable({ round: 7 })
        expect(endDieIsRolled(unheld)).toBe(false)
    })

    it('does not roll before the fifth round even with the Empire holding it', () => {
        expect(endDieIsRolled(statusTable({ round: 4, oathkeeperPlayerId: CHANCELLOR }))).toBe(false)
        expect(endDieIsRolled(statusTable({ round: 8, oathkeeperPlayerId: CHANCELLOR }))).toBe(false)
    })
})

describe('the Stable Regime Win (R-3.3, R-3.3.1)', () => {
    it('ends the game only at or above the round threshold', () => {
        const fifth = statusTable({ round: 5, oathkeeperPlayerId: CHANCELLOR })
        expect(stableRegimeWinner(fifth, 5)).toBeUndefined()
        expect(stableRegimeWinner(fifth, 6)?.winnerPlayerId).toBe(CHANCELLOR)

        const sixth = statusTable({ round: 6, oathkeeperPlayerId: CHANCELLOR })
        expect(stableRegimeWinner(sixth, 4)).toBeUndefined()
        expect(stableRegimeWinner(sixth, 5)?.winnerPlayerId).toBe(CHANCELLOR)

        const seventh = statusTable({ round: 7, oathkeeperPlayerId: CHANCELLOR })
        expect(stableRegimeWinner(seventh, 2)).toBeUndefined()
        expect(stableRegimeWinner(seventh, 3)?.winnerPlayerId).toBe(CHANCELLOR)
    })

    it('never ends the game when no roll was due (R-3.3)', () => {
        const exileHolds = statusTable({ round: 5, oathkeeperPlayerId: EXILE })
        expect(stableRegimeWinner(exileHolds, 6)).toBeUndefined()
    })

    it('gives it to a Citizen meeting the Successor goal instead (R-3.3.1)', () => {
        const state = statusTable(
            {
                round: 7,
                oathkeeperPlayerId: CHANCELLOR,
                oathType: OathType.Devotion
            },
            { [CITIZEN]: { relicIds: [GRAND_SCEPTER_ID] } }
        )
        const outcome = stableRegimeWinner(state, 6)
        expect(outcome).toEqual({
            winnerPlayerId: CITIZEN,
            kind: WinKind.Successor,
            rule: 'R-3.3.1'
        })
    })
})

describe('the War Exhaustion Win is strict precedence (R-3.4)', () => {
    it('R-3.4.1 — the Empire holding the title beats everything below it', () => {
        const state = statusTable(
            {
                round: 8,
                oathkeeperPlayerId: CHANCELLOR,
                visionsDrawn: 3,
                banners: testBanners({ [Banner.PeoplesFavor]: OTHER_EXILE })
            },
            { [OTHER_EXILE]: { revealedVisionId: 'vision.rebellion' } }
        )
        expect(warExhaustionWinner(state)).toEqual({
            winnerPlayerId: CHANCELLOR,
            kind: WinKind.WarExhaustion,
            rule: 'R-3.4.1'
        })
    })

    it('R-3.4.1 yields to a Successor Citizen (R-3.3.1)', () => {
        const state = statusTable({
            round: 8,
            oathkeeperPlayerId: CITIZEN,
            oathType: OathType.Protection,
            banners: testBanners({ [Banner.PeoplesFavor]: CITIZEN })
        })
        expect(warExhaustionWinner(state).winnerPlayerId).toBe(CITIZEN)
        expect(warExhaustionWinner(state).rule).toBe('R-3.3.1')
    })

    it('R-3.4.2 — an Exile Usurper beats a Visionary Exile', () => {
        const state = statusTable(
            {
                round: 8,
                oathkeeperPlayerId: EXILE,
                oathkeeperIsUsurper: true,
                visionsDrawn: 3,
                banners: testBanners({ [Banner.PeoplesFavor]: OTHER_EXILE })
            },
            { [OTHER_EXILE]: { revealedVisionId: 'vision.rebellion' } }
        )
        expect(warExhaustionWinner(state)).toEqual({
            winnerPlayerId: EXILE,
            kind: WinKind.Usurper,
            rule: 'R-3.4.2'
        })
    })

    it('R-3.4.2 needs the Usurper SIDE, not merely the title', () => {
        const state = statusTable({ round: 8, oathkeeperPlayerId: EXILE, oathkeeperIsUsurper: false })
        expect(warExhaustionWinner(state).rule).toBe('R-3.4.4')
    })

    it('R-3.4.3 — a Visionary Exile wins when no title and no Usurper', () => {
        const state = statusTable(
            {
                round: 8,
                visionsDrawn: 3,
                banners: testBanners({ [Banner.DarkestSecret]: EXILE })
            },
            { [EXILE]: { revealedVisionId: 'vision.faith' } }
        )
        expect(warExhaustionWinner(state)).toEqual({
            winnerPlayerId: EXILE,
            kind: WinKind.Visionary,
            rule: 'R-3.4.3'
        })
    })

    it('R-3.4.3 breaks ties in the printed order: Conquest, Rebellion, Sanctuary, Faith', () => {
        const state = statusTable(
            {
                round: 8,
                visionsDrawn: 3,
                banners: testBanners({
                    [Banner.PeoplesFavor]: OTHER_EXILE,
                    [Banner.DarkestSecret]: EXILE
                })
            },
            {
                [EXILE]: { revealedVisionId: 'vision.faith' },
                [OTHER_EXILE]: { revealedVisionId: 'vision.rebellion' }
            }
        )
        expect(warExhaustionWinner(state).winnerPlayerId).toBe(OTHER_EXILE)
    })

    /** Only False Prophet lets two Exiles share one revealed Vision. */
    it('R-3.2-H1 — a shared, tied Vision matches nobody and falls through', () => {
        const state = statusTable(
            {
                round: 8,
                visionsDrawn: 3,
                warbandsBySite: {
                    c1: { [Color.Red]: 1 },
                    p1: { [Color.Yellow]: 1 }
                }
            },
            {
                [EXILE]: { revealedVisionId: 'vision.conquest' },
                [OTHER_EXILE]: { revealedVisionId: 'vision.conquest' }
            }
        )
        expect(warExhaustionWinner(state).rule).toBe('R-3.4.4')
    })

    it('R-3.4.3 respects R-3.2’s three-Visions gate', () => {
        const state = statusTable(
            {
                round: 8,
                visionsDrawn: 2,
                banners: testBanners({ [Banner.DarkestSecret]: EXILE })
            },
            { [EXILE]: { revealedVisionId: 'vision.faith' } }
        )
        expect(warExhaustionWinner(state).rule).toBe('R-3.4.4')
    })

    it('R-3.4.4 always resolves — there is no “nobody wins” branch', () => {
        const state = statusTable({ round: 8 })
        expect(warExhaustionWinner(state)).toEqual({
            winnerPlayerId: CHANCELLOR,
            kind: WinKind.WarExhaustion,
            rule: 'R-3.4.4'
        })
    })

    it('R-3.4.4 yields to a Successor Citizen too (R-3.3.1)', () => {
        const state = statusTable({
            round: 8,
            oathType: OathType.ThePeople,
            banners: testBanners({ [Banner.DarkestSecret]: CITIZEN })
        })
        expect(warExhaustionWinner(state).winnerPlayerId).toBe(CITIZEN)
        expect(warExhaustionWinner(state).rule).toBe('R-3.3.1')
    })

    it('cannot have two Supremacy Successors — the goal is strictly more (R-3.3.1)', () => {
        const state = statusTable(
            { round: 8, oathType: OathType.Supremacy },
            {
                [CITIZEN]: { relicIds: [CUP] },
                [EXILE]: { status: PlayerStatus.Citizen, relicIds: [CROWN] }
            }
        )
        expect(warExhaustionWinner(state).winnerPlayerId).toBe(CHANCELLOR)
    })

    it('refuses to guess if a future power ever duplicates the goal (R-3.3.1)', () => {
        const state = statusTable(
            { round: 8, oathType: OathType.Devotion },
            {
                [CITIZEN]: { relicIds: [GRAND_SCEPTER_ID] },
                [EXILE]: { status: PlayerStatus.Citizen, relicIds: [GRAND_SCEPTER_ID] }
            }
        )
        expect(() => warExhaustionWinner(state)).toThrow(/at most one Successor/)
    })
})

describe('the Wake Phase win checks (R-4.1.2, R-3.1, R-3.2)', () => {
    it('R-3.1 — an Exile holding the title on its Usurper side wins', () => {
        const state = statusTable({ oathkeeperPlayerId: EXILE, oathkeeperIsUsurper: true })
        expect(wakePhaseWin(state, EXILE)).toEqual({
            winnerPlayerId: EXILE,
            kind: WinKind.Usurper,
            rule: 'R-3.1'
        })
    })

    it('R-3.1 does NOT fire on the Wake that takes the title — R-4.1.2 precedes R-4.1.3', () => {
        const state = statusTable({ oathkeeperPlayerId: EXILE, oathkeeperIsUsurper: false })
        expect(wakePhaseWin(state, EXILE)).toBeUndefined()
    })

    it('R-3.2 — an Exile completing a revealed Vision wins', () => {
        const state = statusTable(
            { visionsDrawn: 3, banners: testBanners({ [Banner.PeoplesFavor]: EXILE }) },
            { [EXILE]: { revealedVisionId: 'vision.rebellion' } }
        )
        expect(wakePhaseWin(state, EXILE)).toEqual({
            winnerPlayerId: EXILE,
            kind: WinKind.Visionary,
            rule: 'R-3.2'
        })
    })

    it('R-3.2 is blocked by the three-Visions gate', () => {
        const state = statusTable(
            { visionsDrawn: 2, banners: testBanners({ [Banner.PeoplesFavor]: EXILE }) },
            { [EXILE]: { revealedVisionId: 'vision.rebellion' } }
        )
        expect(wakePhaseWin(state, EXILE)).toBeUndefined()
    })

    it('is Exile-only — the Chancellor and Citizens never win here (R-4.1.2)', () => {
        const state = statusTable({ oathkeeperPlayerId: CHANCELLOR, oathkeeperIsUsurper: true })
        expect(wakePhaseWin(state, CHANCELLOR)).toBeUndefined()
        expect(wakePhaseWin(state, CITIZEN)).toBeUndefined()
    })

    it('does not let one Exile win on another Exile’s title', () => {
        const state = statusTable({ oathkeeperPlayerId: EXILE, oathkeeperIsUsurper: true })
        expect(wakePhaseWin(state, OTHER_EXILE)).toBeUndefined()
    })
})
