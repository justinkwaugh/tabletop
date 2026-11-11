import { controllingOwner, sharesOwned, type StockState } from '@tabletop/18xx'
import { turnOrderFrom } from '@tabletop/common'

/**
 * Who acts for a company in receivership: its largest holder, ties going clockwise from the
 * priority holder (§8).
 */
export function receiverOf(state: StockState, companyId: string): string | undefined {
    const order = turnOrderFrom(state.turnManager.turnOrder, state.turnManager.turnOrder[0])
    const shares = (playerId: string) => sharesOwned(state, companyId, { kind: 'player', playerId })
    const most = Math.max(...order.map(shares))
    return order.find((playerId) => shares(playerId) === most)
}

/** Who decides for a company: its director, or its receiver. */
export function deciderOf(state: StockState, companyId: string): string | undefined {
    return controllingOwner(state, companyId)?.playerId ?? receiverOf(state, companyId)
}
