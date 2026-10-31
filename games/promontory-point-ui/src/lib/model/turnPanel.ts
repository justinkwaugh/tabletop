import {
    LeftoverChoice,
    MachineState,
    RAILROAD_IDS,
    RAILROADS,
    TradeRefusal,
    endTurnDrawCount,
    hasOpenSpace,
    sharePrice,
    tradesLeft,
    turnPlayerId,
    type HydratedPromontoryPointGameState,
    type RailroadId,
    type TurnState
} from '@tabletop/promontory-point'
import { RAILROAD_TAGS } from './railroadTags.js'
import type { PromontoryPointGameSession } from './session.svelte.js'

export type TurnPanelSource = Pick<
    PromontoryPointGameSession,
    | 'gameState'
    | 'decidingPlayerId'
    | 'fourPieceVariant'
    | 'handPieces'
    | 'pickablePieces'
    | 'pickedPiece'
    | 'pickedPieceHasNoRoom'
    | 'buyRefusal'
    | 'sellRefusal'
>

export type TurnPrompt = { lead: string; text: string; note?: string }

export type TurnPieceView = {
    railroadId: RailroadId
    tag: string
    pickable: boolean
    picked: boolean
    noRoom: boolean
}

export type ShareEntryView = {
    railroadId: RailroadId
    name: string
    price: number
    deckCount: number
    held: number
    buyLabel: string
    sellLabel: string
    canBuy: boolean
    canSell: boolean
    buyReason: string | undefined
}

export type ShareBlockView = {
    heading: string
    lockedNote: string | undefined
    entries: ShareEntryView[]
}

export type SetAsideView = { label: string; keepNote?: string }

export type EndTurnChoice = { label: string; keptPiece?: RailroadId; returnKeptPiece?: boolean }

export type TurnPanel = {
    prompt: TurnPrompt
    piecesHeading: string
    pieces: TurnPieceView[]
    placedCount: number
    shares: ShareBlockView
    setAside: SetAsideView | undefined
    endTurn: EndTurnChoice[]
}

const TURN_STATES: readonly MachineState[] = [
    MachineState.TradingBeforePlacing,
    MachineState.Placing,
    MachineState.TradingAfterPlacing
]

// R-2.2-H1: trading reopens after the turn's last placement, the second when a piece is set
// aside with the bag empty (R-3.3-H1), or the first after two.
const ORDINALS = ['first', 'second', 'third'] as const

function lastPieceOrdinal(turn: TurnState): string {
    return ORDINALS[turn.placementsMade + turn.placementsLeft - 1] ?? 'last'
}

// R-2.2: the turn player's panel while it trades, places or ends its turn; none otherwise.
export function turnPanel(source: TurnPanelSource): TurnPanel | undefined {
    const state = source.gameState
    const turn = state.turn
    if (
        turn === undefined ||
        !TURN_STATES.includes(state.machineState) ||
        source.decidingPlayerId === undefined ||
        source.decidingPlayerId !== turnPlayerId(state)
    ) {
        return undefined
    }
    const tradingLocked = state.machineState === MachineState.Placing
    const placingEnded = state.machineState === MachineState.TradingAfterPlacing
    const sharesLeft = tradesLeft(turn)
    return {
        prompt: turnPrompt(source, turn, sharesLeft),
        piecesHeading:
            source.pickablePieces.length > 0 && source.pickedPiece === undefined
                ? 'Your pieces · tap one'
                : 'Your pieces',
        pieces: source.handPieces.map((railroadId) => ({
            railroadId,
            tag: RAILROAD_TAGS[railroadId],
            pickable: source.pickablePieces.includes(railroadId),
            picked: source.pickedPiece === railroadId,
            noRoom: !placingEnded && !hasOpenSpace(state.track, railroadId)
        })),
        placedCount: turn.placementsMade,
        shares: {
            heading: `Shares · ${tradesLeftLabel(sharesLeft)}`,
            lockedNote: tradingLocked
                ? `Buying and selling open again after your ${lastPieceOrdinal(turn)} piece`
                : undefined,
            entries: RAILROAD_IDS.map((railroadId) => shareEntry(source, railroadId))
        },
        setAside: setAside(source, turn),
        endTurn: placingEnded ? endTurnChoices(state, turn, source.fourPieceVariant) : []
    }
}

// R-2.2, R-2.2-H1, R-3.3: what the seat does next, in the order the turn allows.
function turnPrompt(source: TurnPanelSource, turn: TurnState, sharesLeft: number): TurnPrompt {
    const picked = source.pickedPiece
    const placements = turn.placementsMade + turn.placementsLeft
    if (source.gameState.machineState === MachineState.TradingAfterPlacing) {
        return {
            lead: 'Pieces placed.',
            text:
                sharesLeft > 0
                    ? `Buy or sell up to ${sharesLabel(sharesLeft)}, then end your turn.`
                    : 'End your turn.'
        }
    }
    if (picked !== undefined && source.pickedPieceHasNoRoom) {
        return {
            lead: `No room for ${RAILROADS[picked].name}.`,
            text: 'Every space next to its network is taken.'
        }
    }
    const lead = `Place piece ${turn.placementsMade + 1} of ${placements}.`
    if (picked !== undefined) {
        return { lead, text: `Tap a lit hex for ${RAILROADS[picked].name}.` }
    }
    if (source.gameState.machineState === MachineState.Placing) {
        return { lead, text: 'Tap a piece to place.' }
    }
    return {
        lead: 'Your turn.',
        text:
            sharesLeft > 0
                ? `Buy or sell up to ${sharesLabel(sharesLeft)}, then place your ${placements} pieces.`
                : `Place your ${placements} pieces.`,
        note: `Shares open again after the ${lastPieceOrdinal(turn)} piece.`
    }
}

// R-3.1, R-3.2, R-3.2-H1: free or for nothing at 0; a Buy names why it is refused.
function shareEntry(source: TurnPanelSource, railroadId: RailroadId): ShareEntryView {
    const state = source.gameState
    const price = sharePrice(state, railroadId)
    const buyRefusal = source.buyRefusal(railroadId)
    return {
        railroadId,
        name: RAILROADS[railroadId].name,
        price,
        deckCount: state.shareDeckCount(railroadId),
        held: state.getPlayerState(turnPlayerId(state)).shares[railroadId],
        buyLabel: price === 0 ? 'free' : `$${price}`,
        sellLabel: `$${price}`,
        canBuy: buyRefusal === undefined,
        canSell: source.sellRefusal(railroadId) === undefined,
        buyReason: buyRefusalReason(state, buyRefusal)
    }
}

function buyRefusalReason(
    state: HydratedPromontoryPointGameState,
    refusal: TradeRefusal | undefined
): string | undefined {
    switch (refusal) {
        case TradeRefusal.EmptyDeck:
            return 'none left'
        case TradeRefusal.TooLittleMoney:
            return `you have $${state.getPlayerState(turnPlayerId(state)).money}`
        default:
            return undefined
    }
}

// R-3.3, R-3.3-H1, R-X.2: the one-way scrap; R-6.3-H2: a variant piece may be kept instead.
function setAside(source: TurnPanelSource, turn: TurnState): SetAsideView | undefined {
    if (source.pickedPiece === undefined || !source.pickedPieceHasNoRoom) {
        return undefined
    }
    const label = source.gameState.bag.isEmpty()
        ? 'Set aside · bag empty'
        : "Set aside · draw a replacement · can't be undone"
    return source.fourPieceVariant && turn.pieces.length > turn.placementsLeft
        ? { label, keepNote: 'Or keep it: place your other pieces and carry it over face up.' }
        : { label }
}

// R-2.2 step 4, R-6.1-H2, R-6.3: the draw a short bag allows; the variant keeps or returns.
function endTurnChoices(
    state: HydratedPromontoryPointGameState,
    turn: TurnState,
    fourPieceVariant: boolean
): EndTurnChoice[] {
    const inBag = state.bag.count()
    const leftover = turn.pieces.at(0)
    const drawCount = (choice?: LeftoverChoice) => endTurnDrawCount(inBag, fourPieceVariant, choice)
    if (!fourPieceVariant || leftover === undefined) {
        return [{ label: endTurnLabel(drawCount()) }]
    }
    return [
        {
            label: `Keep ${RAILROAD_TAGS[leftover]} · ${drawLabel(drawCount(LeftoverChoice.Kept))}`,
            keptPiece: leftover,
            returnKeptPiece: false
        },
        {
            label: `Return it · ${drawLabel(drawCount(LeftoverChoice.Returned))}`,
            returnKeptPiece: true
        }
    ]
}

function endTurnLabel(drawCount: number): string {
    return `End turn · ${drawLabel(drawCount)}`
}

function drawLabel(drawCount: number): string {
    return drawCount === 0 ? 'bag empty' : `draw ${drawCount}`
}

function tradesLeftLabel(sharesLeft: number): string {
    if (sharesLeft === 0) {
        return 'no share actions left'
    }
    return sharesLeft === 1 ? '1 action left' : `${sharesLeft} actions left`
}

export function sharesLabel(count: number): string {
    return count === 1 ? '1 share' : `${count} shares`
}
