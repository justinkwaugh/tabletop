import { assertExists, type AxialCoordinates, type GameAction } from '@tabletop/common'
import { isDvonnPiece, isMoveStack, isPlacePiece } from '@tabletop/dvonn'

type Span = { id: string; firstIndex: number; lastIndex: number; playerId: string }

export type PlaceEntry = Span & {
    kind: 'place'
    coords: AxialCoordinates
    dvonn: boolean
    // White's last placement, when White cannot make the first move.
    passedPlayerId?: string
}

export type MoveEntry = Span & {
    kind: 'move'
    from: AxialCoordinates
    to: AxialCoordinates
    moved: number
    landedOn: number
    landedOnDvonn: boolean
    removedPieces: number
    removedStacks: number
    // The opponent had no move, so this player moves again next.
    passedPlayerId?: string
}

export type HistoryEntry = PlaceEntry | MoveEntry

export function historyEntries(actions: readonly GameAction[]): HistoryEntry[] {
    return actions.flatMap((action, index): HistoryEntry[] => {
        const span = { id: action.id, firstIndex: index, lastIndex: index }
        if (isPlacePiece(action)) {
            assertExists(action.metadata, 'A processed placement records its piece')
            return [
                {
                    ...span,
                    kind: 'place',
                    playerId: action.playerId,
                    coords: action.coords,
                    dvonn: isDvonnPiece(action.metadata.piece),
                    passedPlayerId: action.metadata.passedPlayerId
                }
            ]
        }
        if (isMoveStack(action)) {
            assertExists(action.metadata, 'A processed move records what it moved')
            const { moved, landedOn, removed, passedPlayerId } = action.metadata
            return [
                {
                    ...span,
                    kind: 'move',
                    playerId: action.playerId,
                    from: action.from,
                    to: action.to,
                    moved: moved.length,
                    landedOn: landedOn.length,
                    landedOnDvonn: landedOn.length === 1 && isDvonnPiece(landedOn[0]),
                    removedPieces: removed.reduce((count, stack) => count + stack.stack.length, 0),
                    removedStacks: removed.length,
                    passedPlayerId
                }
            ]
        }
        // The platform's own actions, such as a concession, have no entry here.
        return []
    })
}
