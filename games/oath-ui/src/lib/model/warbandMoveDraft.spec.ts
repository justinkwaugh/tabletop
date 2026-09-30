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
    it('one owner\'s are tapped on the board; two owners\' are offered by owner in the panel', () => {
        const single = moving({ me: 2 })
        expect(single.boardToSite?.owner).toBe('me')
        expect(single.byOwner).toEqual([])

        // A Citizen whose warbands could not all be replaced holds both (R-6.6.2).
        const two = moving({ me: 2, [IMPERIAL_WARBANDS]: 1 }, PlayerStatus.Citizen)
        expect(two.boardToSite).toBeUndefined()
        expect(
            two.byOwner
                .filter((o) => o.move.kind === WarbandMoveKind.BoardToSite)
                .map((o) => o.owner)
                .sort()
        ).toEqual([IMPERIAL_WARBANDS, 'me'])
    })
})
