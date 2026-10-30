import type { AxialCoordinates, GameAction } from '@tabletop/common'
import {
    isCapture,
    isPass,
    isPlacePiece,
    isStack,
    type Piece,
    type PieceKind
} from '@tabletop/tzaar'

type Span = { id: string; firstIndex: number; lastIndex: number; playerId: string }

// A stack as history tells it: how tall, and the type on top.
export type StackSummary = { height: number; kind?: PieceKind }

export type PlaceEntry = Span & {
    kind: 'place'
    coords: AxialCoordinates
    piece: PieceKind
    // The last placement, when White cannot make the opening capture.
    stuckPlayerId?: string
}

export type CaptureEntry = Span & {
    kind: 'capture'
    from: AxialCoordinates
    to: AxialCoordinates
    moved: StackSummary
    captured: StackSummary
    // The type the opponent no longer has on top, which ends the game.
    eliminated?: PieceKind
    // The turn ended here: White's opening, or nothing was left for a second move.
    opening: boolean
    noSecondMove: boolean
    stuckPlayerId?: string
}

export type StackEntry = Span & {
    kind: 'stack'
    from: AxialCoordinates
    to: AxialCoordinates
    moved: StackSummary
    landedOn: StackSummary
    stuckPlayerId?: string
}

export type PassEntry = Span & { kind: 'pass'; stuckPlayerId?: string }

export type HistoryEntry = PlaceEntry | CaptureEntry | StackEntry | PassEntry

function summary(pieces: readonly Piece[] | undefined): StackSummary {
    return { height: pieces?.length ?? 0, kind: pieces?.at(-1)?.kind }
}

export function historyEntries(actions: readonly GameAction[]): HistoryEntry[] {
    return actions.flatMap((action, index): HistoryEntry[] => {
        if (action.playerId === undefined) return []
        const span = {
            id: action.id,
            firstIndex: index,
            lastIndex: index,
            playerId: action.playerId
        }
        if (isPlacePiece(action)) {
            return [
                {
                    ...span,
                    kind: 'place',
                    coords: action.coords,
                    piece: action.kind,
                    stuckPlayerId: action.metadata?.stuckPlayerId
                }
            ]
        }
        if (isCapture(action)) {
            return [
                {
                    ...span,
                    kind: 'capture',
                    from: action.from,
                    to: action.to,
                    moved: summary(action.metadata?.moved),
                    captured: summary(action.metadata?.captured),
                    eliminated: action.metadata?.eliminatedKind,
                    opening: action.metadata?.opening ?? false,
                    noSecondMove: action.metadata?.noSecondMove ?? false,
                    stuckPlayerId: action.metadata?.stuckPlayerId
                }
            ]
        }
        if (isStack(action)) {
            return [
                {
                    ...span,
                    kind: 'stack',
                    from: action.from,
                    to: action.to,
                    moved: summary(action.metadata?.moved),
                    landedOn: summary(action.metadata?.landedOn),
                    stuckPlayerId: action.metadata?.stuckPlayerId
                }
            ]
        }
        if (isPass(action)) {
            return [{ ...span, kind: 'pass', stuckPlayerId: action.metadata?.stuckPlayerId }]
        }
        return []
    })
}
