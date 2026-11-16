import {
    RAILROAD_IDS,
    paymentTotal,
    type HydratedRideTheRailsGameState,
    type JourneyPayment,
    type RailroadId
} from '@tabletop/ride-the-rails'

export type ShareRow = {
    railroadId: RailroadId
    shares: number
}

export type SeatCard = {
    playerId: string
    position: number
    money: number
    acting: boolean
    rows: ShareRow[]
}

/** A seat's shares in a railroad as the card shows them, given the shown state's count. */
export type ShownShares = (playerId: string, railroadId: RailroadId, shares: number) => number

// Contract, Seat card: one card per seat in turn order (R-2.3), a row per railroad held in R-1.4
// order and none for a railroad not held. Contract, Animation plan, Share: a count that ticks
// ahead of the shown state as a share lands (`shown`) is the one the row shows, so a seat's first
// share in a railroad brings its row in as the locomotive lands.
export function seatCards(state: HydratedRideTheRailsGameState, shown?: ShownShares): SeatCard[] {
    return state.turnManager.turnOrder.map((playerId, index) => {
        const player = state.getPlayerState(playerId)
        return {
            playerId,
            position: index + 1,
            money: player.money,
            acting: state.activePlayerIds.includes(playerId),
            rows: RAILROAD_IDS.map((railroadId) => ({
                railroadId,
                shares: shown
                    ? shown(playerId, railroadId, player.sharesOf(railroadId))
                    : player.sharesOf(railroadId)
            })).filter((row) => row.shares > 0)
        }
    })
}

// Contract, Journey preview: each seat's pending "+$N" (R-3.3.4 dividends, R-3.3.5 fare).
export function pendingGains(payments: readonly JourneyPayment[]): ReadonlyMap<string, number> {
    return new Map(
        payments
            .map((payment) => [payment.playerId, paymentTotal(payment)] as const)
            .filter(([, gain]) => gain > 0)
    )
}
