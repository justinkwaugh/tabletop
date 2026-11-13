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

const MAX_INITIALS = 3

// Art plan, Seat marker: the shortest start of the name, up to three letters, that no other seat's
// name shares; else the first letter and the seat number. A blank name shows the seat number.
export function seatInitials(names: readonly SeatName[]): ReadonlyMap<string, string> {
    const trimmed = names.map(({ name }) => name.trim())
    const initials = trimmed.map((name, index) => {
        const seat = String(index + 1)
        if (!name) return seat
        const others = trimmed.filter((other, otherIndex) => otherIndex !== index && other)
        const shared = (length: number) =>
            others.some(
                (other) =>
                    other.slice(0, length).toLowerCase() === name.slice(0, length).toLowerCase()
            )
        const length = [1, 2, 3]
            .filter((candidate) => candidate <= Math.min(MAX_INITIALS, name.length))
            .find((candidate) => !shared(candidate))
        const first = name.charAt(0).toUpperCase()
        return length ? `${first}${name.slice(1, length).toLowerCase()}` : `${first}${seat}`
    })
    // A name that happens to spell another seat's mark gives way to its seat number.
    const unique = initials.map((mark, index) =>
        initials.indexOf(mark) === initials.lastIndexOf(mark) ? mark : String(index + 1)
    )
    return new Map(names.map(({ playerId }, index) => [playerId, unique[index]]))
}
