import { afterEach, describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { ActionType, MachineState, PlayerStatus, WarbandMoveKind } from '@tabletop/oath'
import { openTurn, testPlayer, testState } from '@tabletop/oath/testing'
import { disposeSessions, openSessionOn, tableOf } from '$lib/testing/sessionHarness.js'

afterEach(disposeSessions)

function moving(warbandsOnBoard: Partial<Record<Color, number>>, status = PlayerStatus.Exile) {
    const state = testState(
        [testPlayer({ playerId: 'me', color: Color.Red, status, siteId: 'c1', warbandsOnBoard })],
        { machineState: MachineState.ActPhase, warbandsBySite: { c1: { [Color.Red]: 1 } } }
    )
    openTurn(state, 'me')
    const session = openSessionOn(tableOf(state))
    session.chooseAction(ActionType.MoveWarbands)
    return session.warbandMoves
}

/** R-6.5 — each colour a player holds may be moved. */
describe('moving warbands of two colours', () => {
    it('one colour is tapped on the board; two are offered by colour in the panel', () => {
        const single = moving({ [Color.Red]: 2 })
        expect(single.boardToSite?.color).toBe(Color.Red)
        expect(single.byColour).toEqual([])

        // A Citizen whose warbands could not all be recoloured holds both (R-6.6.2).
        const two = moving({ [Color.Red]: 2, [Color.Purple]: 1 }, PlayerStatus.Citizen)
        expect(two.boardToSite).toBeUndefined()
        expect(
            two.byColour
                .filter((o) => o.move.kind === WarbandMoveKind.BoardToSite)
                .map((o) => o.color)
                .sort()
        ).toEqual([Color.Purple, Color.Red])
    })
})
