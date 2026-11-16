import { assertExists, type AxialCoordinates, type GameAction } from '@tabletop/common'
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

function entryOf(action: GameAction, index: number): HistoryEntry {
    if (isPlacePiece(action)) {
        return {
            id: action.id,
            firstIndex: index,
            lastIndex: index,
            playerId: action.playerId,
            kind: 'place',
            piece: action.kind,
            at: action.punct,
            passedPlayerId: action.metadata?.passedPlayerId
        }
    }
    if (isMovePiece(action)) {
        const { metadata } = action
        assertExists(metadata, 'A move taken records the piece it moved')
        return {
            id: action.id,
            firstIndex: index,
            lastIndex: index,
            playerId: action.playerId,
            kind: 'move',
            piece: metadata.kind,
            from: action.from,
            to: action.to,
            fromLevel: metadata.fromLevel,
            level: metadata.level,
            passedPlayerId: metadata.passedPlayerId
        }
    }
    throw Error(`PÜNCT has no ${action.type} action`)
}

// One entry for each placement and each move.
export function historyEntries(actions: readonly GameAction[]): HistoryEntry[] {
    return actions.map(entryOf)
}
