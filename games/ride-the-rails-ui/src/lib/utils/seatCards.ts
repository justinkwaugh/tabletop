import {
    MachineState,
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
    money: number
    acting: boolean
    rows: ShareRow[]
    /** The seat's shares one per slot, grouped in R-1.4 order; `undefined` for an empty slot. */
    slots: (RailroadId | undefined)[]
}

/** R-2.1, R-3.1: one share a round for six rounds, so a seat never holds more than six. */
export const SHARE_SLOTS = 6

function shareSlots(rows: readonly ShareRow[]): (RailroadId | undefined)[] {
    const held = rows.flatMap((row) => Array<RailroadId>(row.shares).fill(row.railroadId))
    const empty = Math.max(0, SHARE_SLOTS - held.length)
    return [...held, ...Array<undefined>(empty).fill(undefined)]
}

/** The slot a seat's newest share of a railroad fills, given its shares after taking it. */
export function newShareSlot(
    sharesOf: (railroadId: RailroadId) => number,
    railroadId: RailroadId
): number {
    const through = RAILROAD_IDS.slice(0, RAILROAD_IDS.indexOf(railroadId) + 1)
    return through.reduce((sum, id) => sum + sharesOf(id), 0) - 1
}

/** A seat's shares in a railroad as the card shows them, given the shown state's count. */
export type ShownShares = (playerId: string, railroadId: RailroadId, shares: number) => number

// Contract, Seat card: one card per seat in the order the phase under way is played (R-2.2): the
// reverse of turn order while shares are taken, turn order otherwise (R-2.3). A row per railroad held in R-1.4 order and none for a railroad not held, and the same shares
// one per slot in six slots (SHARE_SLOTS). Contract, Animation plan, Share: a count that ticks
// ahead of the shown state as a share lands (`shown`) is the one the row shows, so a seat's first
// share in a railroad brings its row in as the locomotive lands.
export function seatCards(state: HydratedRideTheRailsGameState, shown?: ShownShares): SeatCard[] {
    const turnOrder = state.turnManager.turnOrder
    const phaseOrder =
        state.machineState === MachineState.TakingShares ? [...turnOrder].reverse() : turnOrder
    return phaseOrder.map((playerId) => {
        const player = state.getPlayerState(playerId)
        const rows = RAILROAD_IDS.map((railroadId) => ({
            railroadId,
            shares: shown
                ? shown(playerId, railroadId, player.sharesOf(railroadId))
                : player.sharesOf(railroadId)
        })).filter((row) => row.shares > 0)
        return {
            playerId,
            money: player.money,
            acting: state.activePlayerIds.includes(playerId),
            rows,
            slots: shareSlots(rows)
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
