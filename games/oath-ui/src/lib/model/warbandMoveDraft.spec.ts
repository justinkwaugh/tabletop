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

function moving(warbandsOnBoard: WarbandCounts, status = PlayerStatus.Exile, atSite = 1) {
    const state = testState(
        [testPlayer({ playerId: 'me', color: Color.Red, status, siteId: 'c1', warbandsOnBoard })],
        { machineState: MachineState.ActPhase, warbandsBySite: { c1: { me: atSite } } }
    )
    openTurn(state, 'me')
    const session = openSessionOn(tableOf(state))
    session.chooseAction(ActionType.MoveWarbands)
    return session.warbandMoves
}

/** R-6.5 — each owner's warbands a player holds may be moved. */
describe('moving warbands of two owners', () => {
    it('lists one row per owner and direction, so a Citizen holding both owners sees both', () => {
        const single = moving({ me: 2 })
        expect(single.options.filter((o) => o.move.kind === WarbandMoveKind.BoardToSite).map((o) => o.owner)).toEqual(['me'])

        // A Citizen whose warbands could not all be replaced holds both (R-6.6.2).
        const two = moving({ me: 2, [IMPERIAL_WARBANDS]: 1 }, PlayerStatus.Citizen)
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
    it('names the seat’s site for a move from the board, and nothing for a move to the board', () => {
        const draft = moving({ me: 2 }, PlayerStatus.Exile, 3)
        const onto = draft.options.find((o) => o.move.kind === WarbandMoveKind.BoardToSite)
        const off = draft.options.find((o) => o.move.kind === WarbandMoveKind.SiteToBoard)
        if (!onto || !off) throw Error('Both directions are offered')
        expect(draft.points(onto)).toEqual({ kind: 'site', slotId: 'c1' })
        expect(draft.points(off)).toBeUndefined()
    })

    it('refuses a count the row does not offer', async () => {
        const draft = moving({ me: 2 })
        const onto = draft.options.find((o) => o.move.kind === WarbandMoveKind.BoardToSite)
        if (!onto) throw Error('A move onto the site is offered')
        await expect(draft.sendNow(onto, onto.max + 1)).rejects.toThrow('a count its row offers')
    })
})
