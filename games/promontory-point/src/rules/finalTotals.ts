import { sharePriceAt } from '../components/priceTrack.js'
import { RAILROAD_IDS, perRailroad, type RailroadId } from '../components/railroads.js'
import type { PromontoryPointProjectedState } from '../model/gameState.js'

export type RailroadHolding = {
    shares: number
    price: number
    value: number
}

export type FinalTotal = {
    playerId: string
    money: number
    holdings: Record<RailroadId, RailroadHolding>
    shareValue: number
    total: number
}

// R-6.2: money plus each share at its railroad's final price.
export function finalTotals(
    state: Pick<PromontoryPointProjectedState, 'players' | 'priceIndex'>
): FinalTotal[] {
    return state.players.map((player) => {
        const holdings = perRailroad((railroadId) => {
            const shares = player.shares[railroadId]
            const price = sharePriceAt(state.priceIndex[railroadId])
            return { shares, price, value: shares * price }
        })
        const shareValue = RAILROAD_IDS.reduce(
            (sum, railroadId) => sum + holdings[railroadId].value,
            0
        )
        return {
            playerId: player.playerId,
            money: player.money,
            holdings,
            shareValue,
            total: player.money + shareValue
        }
    })
}

// R-6.2, R-6.2-H1: every tied leader wins; there is no tie-break.
export function winningPlayerIds(totals: FinalTotal[]): string[] {
    const leadingTotal = Math.max(...totals.map((total) => total.total))
    return totals.filter((total) => total.total === leadingTotal).map((total) => total.playerId)
}
