import {
    assertExists,
    isCallGameAction,
    type AxialCoordinates,
    type CallGameAction,
    type GameAction
} from '@tabletop/common'
import {
    isCapture,
    isPass,
    isPlacePiece,
    isStack,
    type PieceKind,
    type StackSummary
} from '@tabletop/tzaar'

type Span = { id: string; firstIndex: number; lastIndex: number; playerId: string }

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
    landedOnHeight: number
    stuckPlayerId?: string
}

export type PassEntry = Span & { kind: 'pass'; stuckPlayerId?: string }

export type MoveEntry = PlaceEntry | CaptureEntry | StackEntry | PassEntry

// A call, a concession or a stall ends the game with a system action of its own.
export type CallEntry = {
    kind: 'call'
    id: string
    firstIndex: number
    lastIndex: number
    action: CallGameAction
}

export type HistoryEntry = MoveEntry | CallEntry

// Every action played records what history tells of it.
function recorded<T>(metadata: T | undefined): T {
    assertExists(metadata, 'A played action records its outcome')
    return metadata
}

export function historyEntries(actions: readonly GameAction[]): HistoryEntry[] {
    return actions.flatMap((action, index): HistoryEntry[] => {
        if (isCallGameAction(action)) {
            return [{ kind: 'call', id: action.id, firstIndex: index, lastIndex: index, action }]
        }
        if (action.playerId === undefined) return []
        const span = {
            id: action.id,
            firstIndex: index,
            lastIndex: index,
            playerId: action.playerId
        }
        if (isPlacePiece(action)) {
            const metadata = recorded(action.metadata)
            return [
                {
                    ...span,
                    kind: 'place',
                    coords: action.coords,
                    piece: action.kind,
                    stuckPlayerId: metadata.stuckPlayerId
                }
            ]
        }
        if (isCapture(action)) {
            const metadata = recorded(action.metadata)
            return [
                {
                    ...span,
                    kind: 'capture',
                    from: action.from,
                    to: action.to,
                    moved: metadata.moved,
                    captured: metadata.captured,
                    eliminated: metadata.eliminatedKind,
                    opening: metadata.opening === true,
                    noSecondMove: metadata.noSecondMove === true,
                    stuckPlayerId: metadata.stuckPlayerId
                }
            ]
        }
        if (isStack(action)) {
            const metadata = recorded(action.metadata)
            return [
                {
                    ...span,
                    kind: 'stack',
                    from: action.from,
                    to: action.to,
                    moved: metadata.moved,
                    landedOnHeight: metadata.landedOnHeight,
                    stuckPlayerId: metadata.stuckPlayerId
                }
            ]
        }
        if (isPass(action)) {
            const { stuckPlayerId } = recorded(action.metadata)
            return [{ ...span, kind: 'pass', stuckPlayerId }]
        }
        return []
    })
}
