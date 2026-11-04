import { afterEach, describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import {
    ActionType,
    IMPERIAL_WARBANDS,
    MachineState,
    PlayerStatus,
    WarbandMoveKind,
    type WarbandCounts
} from '@tabletop/oath'
import { openTurn, testPlayer, testState } from '@tabletop/oath/testing'
import { disposeSessions, openSessionOn, tableOf } from '$lib/testing/sessionHarness.js'

afterEach(disposeSessions)

async function moving(warbandsOnBoard: WarbandCounts, status = PlayerStatus.Exile, atSite = 1) {
    const state = testState(
        [testPlayer({ playerId: 'me', color: Color.Red, status, siteId: 'c1', warbandsOnBoard })],
        { machineState: MachineState.ActPhase, warbandsBySite: { c1: { me: atSite } } }
    )
    openTurn(state, 'me')
    const session = await openSessionOn(tableOf(state))
    session.chooseAction(ActionType.MoveWarbands)
    return session.warbandMoves
}

/** R-6.5 — each owner's warbands a player holds may be moved. */
describe('moving warbands of two owners', () => {
    it('lists one row per owner and direction, so a Citizen holding both owners sees both', async () => {
        const single = await moving({ me: 2 })
        expect(
            single.options
                .filter((o) => o.move.kind === WarbandMoveKind.BoardToSite)
                .map((o) => o.owner)
        ).toEqual(['me'])

        // A Citizen whose warbands could not all be replaced holds both (R-6.6.2).
        const two = await moving({ me: 2, [IMPERIAL_WARBANDS]: 1 }, PlayerStatus.Citizen)
        expect(
            two.options
                .filter((o) => o.move.kind === WarbandMoveKind.BoardToSite)
                .map((o) => o.owner)
                .sort()
        ).toEqual([IMPERIAL_WARBANDS, 'me'])
    })
})

/** Rule 3 — the move onto the seat's site lights that site; a move to the board names nothing there. */
describe('what a warband move row names on the table', () => {
    it('names the seat’s site for a move from the board, and nothing for a move to the board', async () => {
        const draft = await moving({ me: 2 }, PlayerStatus.Exile, 3)
        const onto = draft.options.find((o) => o.move.kind === WarbandMoveKind.BoardToSite)
        const off = draft.options.find((o) => o.move.kind === WarbandMoveKind.SiteToBoard)
        if (!onto || !off) throw Error('Both directions are offered')
        expect(draft.points(onto)).toEqual({ kind: 'site', slotId: 'c1' })
        expect(draft.points(off)).toBeUndefined()
    })

    it('refuses a count the row does not offer', async () => {
        const draft = await moving({ me: 2 })
        const onto = draft.options.find((o) => o.move.kind === WarbandMoveKind.BoardToSite)
        if (!onto) throw Error('A move onto the site is offered')
        await expect(draft.sendNow(onto, onto.max + 1)).rejects.toThrow('a count its row offers')
    })
})

/** Ring of Devotion: "You cannot place warbands at sites"; the panel lists only what the engine accepts. */
describe('moving warbands while holding the Ring of Devotion', () => {
    async function holdingTheRing(atSite: number) {
        const state = testState(
            [
                testPlayer({
                    playerId: 'me',
                    color: Color.Red,
                    siteId: 'c1',
                    warbandsOnBoard: { me: 3 },
                    relicIds: ['relic.ring-of-devotion']
                })
            ],
            { machineState: MachineState.ActPhase, warbandsBySite: { c1: { me: atSite } } }
        )
        openTurn(state, 'me')
        return openSessionOn(tableOf(state))
    }

    it('shows no row onto the site, and the lift from it', async () => {
        const session = await holdingTheRing(2)
        expect(session.validActionTypes).toContain(ActionType.MoveWarbands)
        session.chooseAction(ActionType.MoveWarbands)
        expect(session.warbandMoves.options.map((o) => [o.move.kind, o.max])).toEqual([
            [WarbandMoveKind.SiteToBoard, 1]
        ])
    })

    it('does not offer the action when the only move would be onto the site', async () => {
        const session = await holdingTheRing(1)
        expect(session.validActionTypes).not.toContain(ActionType.MoveWarbands)
        expect(session.validActionTypes).toContain(ActionType.EndActPhase)
    })
})
