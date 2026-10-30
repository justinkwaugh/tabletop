import type { GameAction } from '@tabletop/common'
import {
    TownEventKind,
    isPayRepairs,
    type HydratedPromontoryPointGameState,
    type RailroadId
} from '@tabletop/promontory-point'
import { repairsPlacementBeingDecided } from './thisTurn.js'

export enum RepairsSeatState {
    // Held none of the railroad, so billed nothing.
    NoShares = 'NoShares',
    // Paid the bill in full, at once or by its own payment.
    Paid = 'Paid',
    // Paid all its money; the rest of the bill was forgiven (R-4.3-H3).
    Forgiven = 'Forgiven',
    // The first short seat, choosing shares to sell.
    Choosing = 'Choosing',
    // A short seat later in the deciding order.
    Waiting = 'Waiting'
}

export type RepairsRowEntry = {
    playerId: string
    bill: number
    state: RepairsSeatState
    // The bill less the seat's money, for the deciding seat.
    short?: number
    // What follows the bill, e.g. "paid $6" or "choosing shares to sell".
    text: string
    // A tick after the text: the bill is paid in full.
    paidInFull: boolean
}

export type RepairsRowView = {
    railroadId: RailroadId
    placingPlayerId: string
    entries: RepairsRowEntry[]
}

// R-4.3, R-4.3-H1, R-4.3-H4: every seat's bill and where it stands, while a Repairs is being paid.
// Read from the displayed state and the actions behind it, never from what a seat has staged.
export function repairsRow(
    state: HydratedPromontoryPointGameState,
    actions: readonly GameAction[]
): RepairsRowView | undefined {
    const pending = state.pendingRepairs
    const placement = repairsPlacementBeingDecided(state, actions)
    const outcome = placement?.metadata?.outcome
    if (
        pending === undefined ||
        placement === undefined ||
        outcome === undefined ||
        outcome.kind !== TownEventKind.Repairs
    ) {
        return undefined
    }
    const placingIndex = actions.lastIndexOf(placement)
    const payments = actions.slice(placingIndex + 1).filter(isPayRepairs)
    const { turnOrder } = state.turnManager
    const placingSeat = Math.max(0, turnOrder.indexOf(placement.playerId))
    const seatOrderFromPlacing = [
        ...turnOrder.slice(placingSeat),
        ...turnOrder.slice(0, placingSeat)
    ]
    const entries = seatOrderFromPlacing.map((playerId): RepairsRowEntry => {
        const bill = outcome.bills.find((billed) => billed.playerId === playerId)
        if (bill === undefined) {
            return {
                playerId,
                bill: 0,
                state: RepairsSeatState.NoShares,
                text: 'no shares',
                paidInFull: false
            }
        }
        if (bill.paid === bill.owed) {
            return paid(playerId, bill.owed)
        }
        const payment = payments.find((sent) => sent.playerId === playerId)?.metadata
        if (payment !== undefined) {
            return payment.forgiven > 0
                ? {
                      playerId,
                      bill: bill.owed,
                      state: RepairsSeatState.Forgiven,
                      text: `paid $${payment.paid} · $${payment.forgiven} forgiven`,
                      paidInFull: false
                  }
                : paid(playerId, bill.owed)
        }
        if (pending.debtors[0]?.playerId === playerId) {
            const money = state.getPlayerState(playerId).money
            return {
                playerId,
                bill: bill.owed,
                state: RepairsSeatState.Choosing,
                short: bill.owed - money,
                text: 'choosing shares to sell',
                paidInFull: false
            }
        }
        return {
            playerId,
            bill: bill.owed,
            state: RepairsSeatState.Waiting,
            text: 'waiting',
            paidInFull: false
        }
    })
    return { railroadId: pending.railroadId, placingPlayerId: placement.playerId, entries }
}

function paid(playerId: string, bill: number): RepairsRowEntry {
    return {
        playerId,
        bill,
        state: RepairsSeatState.Paid,
        text: `paid $${bill}`,
        paidInFull: true
    }
}
