import type { GameAction } from '@tabletop/common'
import {
    MachineState,
    RAILROAD_IDS,
    TownEventKind,
    isBuyShare,
    isPayRepairs,
    isPlaceTrack,
    isSellShare,
    sharePrice,
    type HydratedPromontoryPointGameState,
    type RailroadId
} from '@tabletop/promontory-point'
import { RAILROAD_TAGS } from './railroadTags.js'

// R-5, R-2.2 step 1: how a seat's hand is seen from the viewer's seat.
export enum HandPerspective {
    // The turn player's pieces, face up for everyone from the start of the turn.
    Revealed = 'Revealed',
    // The viewer's own concealed hand.
    Own = 'Own',
    // Any other concealed hand: its count only.
    Hidden = 'Hidden'
}

export enum SeatTag {
    Placing = 'placing',
    Repairs = 'repairs'
}

// One hand piece as drawn: its railroad only when the perspective shows its face.
export type HandPieceView = { faceShown: true; railroadId: RailroadId } | { faceShown: false }

export type SeatHandView = {
    perspective: HandPerspective
    pieces: HandPieceView[]
    // R-6.3-H2: the variant's kept piece stays face up for everyone.
    keptPiece?: RailroadId
    caption: string
}

export type SeatShareView = {
    railroadId: RailroadId
    count: number
    price: number
    countLabel: string
    priceLabel: string
}

export type SeatView = {
    playerId: string
    // R-1.3-H1: money is public.
    money: number
    tag?: SeatTag
    // R-X.1: the state asks this seat to decide (the amber ring).
    active: boolean
    // R-4.3-H4: the seat whose turn waits while a debtor decides.
    waitingTurn: boolean
    shares: SeatShareView[]
    // O-9: the shares' worth at today's prices.
    worth: number
    hand: SeatHandView
}

function currentTurnPlayerId(state: HydratedPromontoryPointGameState): string | undefined {
    return state.turn === undefined ? undefined : state.turnManager.currentTurn()?.playerId
}

// R-5, R-2.2 step 1, R-6.3-H2: decided by rule from the seats alone, never from which hands the
// client happens to hold (a Local game or Host View holds them all).
export function handPerspective(
    state: HydratedPromontoryPointGameState,
    playerId: string,
    viewerId: string | undefined
): HandPerspective {
    if (currentTurnPlayerId(state) === playerId) {
        return HandPerspective.Revealed
    }
    return viewerId === playerId ? HandPerspective.Own : HandPerspective.Hidden
}

// A seat card's share stack draws at most this many cards, however many are held.
export const STACK_CARDS = 4

const faceUp = (railroadId: RailroadId): HandPieceView => ({ faceShown: true, railroadId })

function handView(
    state: HydratedPromontoryPointGameState,
    playerId: string,
    viewerId: string | undefined
): SeatHandView {
    const player = state.getPlayerState(playerId)
    const perspective = handPerspective(state, playerId, viewerId)
    const kept = player.keptPiece === undefined ? {} : { keptPiece: player.keptPiece }
    const keptNote = player.keptPiece === undefined ? '' : ' · 1 kept'
    switch (perspective) {
        case HandPerspective.Revealed:
            return {
                perspective,
                pieces: (state.turn?.pieces ?? []).map(faceUp),
                caption: 'hand, revealed'
            }
        case HandPerspective.Own:
            return {
                perspective,
                pieces: player.knownHand().map(faceUp),
                ...kept,
                caption: `${player.handCount === 0 ? 'yours, empty' : 'yours, hidden'}${keptNote}`
            }
        case HandPerspective.Hidden:
            return {
                perspective,
                pieces: Array.from({ length: player.handCount }, () => ({ faceShown: false })),
                ...kept,
                // R-6.1-H2: the bag can run out, leaving a seat with nothing in hand.
                caption: `${player.handCount === 0 ? 'hand: empty' : `hand: ${player.handCount} hidden`}${keptNote}`
            }
    }
}

function deciderOfRepairs(state: HydratedPromontoryPointGameState): string | undefined {
    return state.machineState === MachineState.PayingRepairs
        ? state.pendingRepairs?.debtors[0]?.playerId
        : undefined
}

// Contract, "Seat card": one derivation of a seat, read by the seat card and the open seat.
export function seatView(
    state: HydratedPromontoryPointGameState,
    playerId: string,
    viewerId: string | undefined
): SeatView {
    const player = state.getPlayerState(playerId)
    const turnPlayerId = currentTurnPlayerId(state)
    const debtorId = deciderOfRepairs(state)
    const active = state.activePlayerIds.includes(playerId)
    const shares = RAILROAD_IDS.map((railroadId) => {
        const count = player.shares[railroadId]
        const price = sharePrice(state, railroadId)
        return { railroadId, count, price, countLabel: `×${count}`, priceLabel: `$${price} ea` }
    })
    // Contract, "Seat card": a tag only on the seat that decides, so none on a turn that waits.
    const tag =
        debtorId === playerId
            ? SeatTag.Repairs
            : turnPlayerId === playerId && debtorId === undefined
              ? SeatTag.Placing
              : undefined
    return {
        playerId,
        money: player.money,
        ...(tag === undefined ? {} : { tag }),
        active,
        waitingTurn: debtorId !== undefined && turnPlayerId === playerId && !active,
        shares,
        worth: shares.reduce((sum, share) => sum + share.count * share.price, 0),
        hand: handView(state, playerId, viewerId)
    }
}

// Contract, "Seat card": every seat in seat order (R-2.1).
export function seatViews(
    state: HydratedPromontoryPointGameState,
    viewerId: string | undefined
): SeatView[] {
    return state.turnManager.turnOrder.map((playerId) => seatView(state, playerId, viewerId))
}

export type MoneyLine = { key: string; label: string; change: number }

const tag = (railroadId: RailroadId) => RAILROAD_TAGS[railroadId]

// The money a seat gained or paid in one action, read from its input and metadata.
function moneyLine(action: GameAction, playerId: string): MoneyLine | undefined {
    if (isBuyShare(action) && action.playerId === playerId && action.metadata) {
        const label = `Bought a ${tag(action.railroadId)} share`
        return { key: action.id, label, change: -action.metadata.price }
    }
    if (isSellShare(action) && action.playerId === playerId && action.metadata) {
        const label = `Sold a ${tag(action.railroadId)} share`
        return { key: action.id, label, change: action.metadata.price }
    }
    if (isPayRepairs(action) && action.playerId === playerId && action.metadata) {
        const { sales, paid } = action.metadata
        const proceeds = sales.reduce((sum, sale) => sum + sale.proceeds, 0)
        const label = sales.length === 0 ? 'Paid Repairs' : 'Sold shares and paid Repairs'
        return { key: action.id, label, change: proceeds - paid }
    }
    const outcome = isPlaceTrack(action) ? action.metadata?.outcome : undefined
    if (outcome?.kind === TownEventKind.Dividend) {
        const payment = outcome.payments.find((entry) => entry.playerId === playerId)
        return payment === undefined
            ? undefined
            : {
                  key: action.id,
                  label: `Dividend on ${tag(outcome.railroadId)}`,
                  change: payment.amount
              }
    }
    if (outcome?.kind === TownEventKind.Repairs) {
        const bill = outcome.bills.find((entry) => entry.playerId === playerId)
        return bill === undefined || bill.paid === 0
            ? undefined
            : {
                  key: action.id,
                  label: `Repairs on ${tag(outcome.railroadId)}`,
                  change: -bill.paid
              }
    }
    return undefined
}

// Contract, "Seat card": the open seat's money history of the turn on display.
export function moneyLinesOfTurn(
    turnActions: readonly GameAction[],
    playerId: string
): MoneyLine[] {
    return turnActions.flatMap((action) => {
        const line = moneyLine(action, playerId)
        return line === undefined || line.change === 0 ? [] : [line]
    })
}
