import {
    assertExists,
    isCallGameAction,
    type AxialCoordinates,
    type CallGameAction,
    type GameAction
} from '@tabletop/common'
import {
    isChooseColor,
    isDvonnPiece,
    isMoveStack,
    isPlacePiece,
    type PieceColor
} from '@tabletop/dvonn'

type Span = { id: string; firstIndex: number; lastIndex: number; playerId: string }

export type PlaceEntry = Span & {
    kind: 'place'
    coords: AxialCoordinates
    dvonn: boolean
    // The piece's colour, told when the setter of an I set, you choose board places for both.
    color?: PieceColor
    // White's last placement, when White cannot make the first move.
    passedPlayerId?: string
}

export type ChooseEntry = Span & {
    kind: 'choose'
    color: PieceColor
    // White, when the set board leaves them no first move.
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

export type PlayerEntry = PlaceEntry | ChooseEntry | MoveEntry

// A call, a concession or a stall ends the game with a system action of its own.
export type CallEntry = {
    kind: 'call'
    id: string
    firstIndex: number
    lastIndex: number
    action: CallGameAction
}

export type HistoryEntry = PlayerEntry | CallEntry

export function historyEntries(actions: readonly GameAction[]): HistoryEntry[] {
    return actions.flatMap((action, index): HistoryEntry[] => {
        const span = { id: action.id, firstIndex: index, lastIndex: index }
        if (isCallGameAction(action)) return [{ ...span, kind: 'call', action }]
        if (isPlacePiece(action)) {
            assertExists(action.metadata, 'A processed placement records its piece')
            return [
                {
                    ...span,
                    kind: 'place',
                    playerId: action.playerId,
                    coords: action.coords,
                    dvonn: isDvonnPiece(action.metadata.piece),
                    color: action.metadata.color,
                    passedPlayerId: action.metadata.passedPlayerId
                }
            ]
        }
        if (isChooseColor(action)) {
            assertExists(action.metadata, 'A processed choice of colour records its outcome')
            return [
                {
                    ...span,
                    kind: 'choose',
                    playerId: action.playerId,
                    color: action.color,
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
        return []
    })
}
