import type { AxialCoordinates, GameAction } from '@tabletop/common'
import { isMovePiece, isPlacePiece, PieceKind } from '@tabletop/punct'

type Span = { id: string; firstIndex: number; lastIndex: number; playerId: string }

export type PlaceEntry = Span & {
    kind: 'place'
    piece: PieceKind
    at: AxialCoordinates
    passedPlayerId?: string
}

export type MoveEntry = Span & {
    kind: 'move'
    piece: PieceKind
    from: AxialCoordinates
    to: AxialCoordinates
    fromLevel: number
    level: number
    passedPlayerId?: string
}

export type HistoryEntry = PlaceEntry | MoveEntry

function entryOf(action: GameAction, index: number): HistoryEntry | undefined {
    if (action.playerId === undefined) return undefined
    const span = { id: action.id, firstIndex: index, lastIndex: index, playerId: action.playerId }
    if (isPlacePiece(action)) {
        return {
            ...span,
            kind: 'place',
            piece: action.kind,
            at: action.punct,
            passedPlayerId: action.metadata?.passedPlayerId
        }
    }
    if (isMovePiece(action)) {
        return {
            ...span,
            kind: 'move',
            piece: action.metadata?.kind ?? PieceKind.Triangle,
            from: action.from,
            to: action.to,
            fromLevel: action.metadata?.fromLevel ?? 0,
            level: action.metadata?.level ?? 0,
            passedPlayerId: action.metadata?.passedPlayerId
        }
    }
    return undefined
}

// One entry for each placement and each move.
export function historyEntries(actions: readonly GameAction[]): HistoryEntry[] {
    return actions.flatMap((action, index) => entryOf(action, index) ?? [])
}
