import { assert } from '@tabletop/common'
import type { PromontoryPointProjectedState } from '../model/gameState.js'
import type { Debtor } from '../model/pendingRepairs.js'

// R-4.3-H4: the placing player first if short, then seat order from the placing player.
export function debtorOrder(
    state: Pick<PromontoryPointProjectedState, 'turnManager'>,
    placingPlayerId: string,
    debtors: Debtor[]
): Debtor[] {
    return seatOrderFrom(state, placingPlayerId).flatMap((playerId) =>
        debtors.filter((debtor) => debtor.playerId === playerId)
    )
}

export function seatOrderFrom(
    state: Pick<PromontoryPointProjectedState, 'turnManager'>,
    firstPlayerId: string
): string[] {
    const { turnOrder } = state.turnManager
    const firstSeat = turnOrder.indexOf(firstPlayerId)
    assert(firstSeat >= 0, `No seat for player ${firstPlayerId}`)
    return [...turnOrder.slice(firstSeat), ...turnOrder.slice(0, firstSeat)]
}
