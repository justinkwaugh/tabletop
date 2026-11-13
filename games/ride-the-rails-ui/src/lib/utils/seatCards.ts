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

export type SeatName = {
    playerId: string
    name: string
}

// Contract, Seat card: one card per seat in turn order (R-2.3), a row per railroad held in R-1.4
// order and none for a railroad not held.
export function seatCards(state: HydratedRideTheRailsGameState): SeatCard[] {
    return state.turnManager.turnOrder.map((playerId, index) => {
        const player = state.getPlayerState(playerId)
        return {
            playerId,
            position: index + 1,
            money: player.money,
            acting: state.activePlayerIds.includes(playerId),
            rows: RAILROAD_IDS.map((railroadId) => ({
                railroadId,
                shares: player.sharesOf(railroadId)
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

// Art plan, Seat marker: one initial, or two letters for seats that share one.
export function seatInitials(names: readonly SeatName[]): ReadonlyMap<string, string> {
    const firstLetter = (name: string) => name.trim().charAt(0).toUpperCase()
    return new Map(
        names.map(({ playerId, name }) => {
            const shared = names.some(
                (other) =>
                    other.playerId !== playerId && firstLetter(other.name) === firstLetter(name)
            )
            const trimmed = name.trim()
            return [
                playerId,
                shared
                    ? `${firstLetter(trimmed)}${trimmed.charAt(1).toLowerCase()}`
                    : firstLetter(trimmed)
            ]
        })
    )
}
