import { assert } from '@tabletop/common'
import type { PromontoryPointProjectedState } from '../model/gameState.js'
import type { Debtor } from '../model/pendingRepairs.js'

// R-4.3-H4: the placing player first if short, then seat order from the placing player.
export function debtorOrder(
    state: Pick<PromontoryPointProjectedState, 'turnManager'>,
    placingPlayerId: string,
    debtors: Debtor[]
): Debtor[] {
    const { turnOrder } = state.turnManager
    const placingSeat = turnOrder.indexOf(placingPlayerId)
    assert(placingSeat >= 0, `No seat for the placing player ${placingPlayerId}`)
    const seatOrderFromPlacing = [
        ...turnOrder.slice(placingSeat),
        ...turnOrder.slice(0, placingSeat)
    ]
    return seatOrderFromPlacing.flatMap((playerId) =>
        debtors.filter((debtor) => debtor.playerId === playerId)
    )
}
