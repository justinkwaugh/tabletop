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

function moving(warbandsOnBoard: WarbandCounts, status = PlayerStatus.Exile) {
    const state = testState(
        [testPlayer({ playerId: 'me', color: Color.Red, status, siteId: 'c1', warbandsOnBoard })],
        { machineState: MachineState.ActPhase, warbandsBySite: { c1: { me: 1 } } }
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
