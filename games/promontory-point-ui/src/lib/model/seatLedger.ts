import {
    RAILROAD_IDS,
    finalTotals,
    sharePrice,
    type HydratedPromontoryPointGameState,
    type RailroadId
} from '@tabletop/promontory-point'
import { RAILROAD_TAGS } from './railroadTags.js'
import { HandPerspective, seatViews, type SeatTag } from './seatView.js'

// One railroad's column: its tag and today's price (R-1.2).
export type LedgerColumn = { railroadId: RailroadId; tag: string; price: number }

// A seat's holding of one railroad and what it is worth at today's price.
export type LedgerCell = { railroadId: RailroadId; count: number; worth: number }

export type LedgerRow = {
    playerId: string
    // R-1.3-H1: money is public.
    money: number
    cells: LedgerCell[]
    shareWorth: number
    // R-6.2: money plus each share at its railroad's price, summed as the final score sums it.
    score: number
    // R-X.1: the state asks this seat to decide (the amber row).
    active: boolean
    // R-4.3-H4: the seat whose turn waits while a debtor decides.
    waitingTurn: boolean
    tag?: SeatTag
    // R-2.2 step 1: the turn player's pieces, face up for every seat.
    revealedHand?: RailroadId[]
    // R-6.3-H2: the four-piece variant's kept piece, face up for every seat.
    keptPiece?: RailroadId
}

export type SeatLedger = { columns: LedgerColumn[]; rows: LedgerRow[] }

// Contract, "Seat ledger": every seat in seat order (R-2.1), one row each, read from the displayed
// state. Only public facts: money, shares, the revealed hand and a kept piece (R-5).
export function seatLedger(
    state: HydratedPromontoryPointGameState,
    viewerId: string | undefined
): SeatLedger {
    const totals = new Map(finalTotals(state).map((total) => [total.playerId, total]))
    const rows = seatViews(state, viewerId).map((view): LedgerRow => {
        const total = totals.get(view.playerId)
        const score = total?.total ?? view.money
        const revealed = view.hand.perspective === HandPerspective.Revealed
        return {
            playerId: view.playerId,
            money: view.money,
            cells: view.shares.map(({ railroadId, count, price }) => ({
                railroadId,
                count,
                worth: count * price
            })),
            shareWorth: total?.shareValue ?? view.worth,
            score,
            active: view.active,
            waitingTurn: view.waitingTurn,
            ...(view.tag === undefined ? {} : { tag: view.tag }),
            ...(revealed
                ? {
                      revealedHand: view.hand.pieces.flatMap((piece) =>
                          piece.faceShown ? [piece.railroadId] : []
                      )
                  }
                : {}),
            ...(view.hand.keptPiece === undefined ? {} : { keptPiece: view.hand.keptPiece })
        }
    })
    return {
        columns: RAILROAD_IDS.map((railroadId) => ({
            railroadId,
            tag: RAILROAD_TAGS[railroadId],
            price: sharePrice(state, railroadId)
        })),
        rows
    }
}
