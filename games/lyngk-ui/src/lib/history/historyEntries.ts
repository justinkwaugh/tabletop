import {
    isCallGameAction,
    type AxialCoordinates,
    type CallGameAction,
    type GameAction
} from '@tabletop/common'
import { isClaimColor, isMoveStack, isPlacePiece, type PieceColor } from '@tabletop/lyngk'

type Span = { id: string; firstIndex: number; lastIndex: number; playerId: string }

export type MoveEntry = Span & {
    kind: 'move'
    claimed?: PieceColor
    moved: PieceColor[]
    from: AxialCoordinates
    via: AxialCoordinates[]
    to: AxialCoordinates
    height: number
    scored: boolean
    // The player this move's end passed over, who had no move, so the mover moves again.
    passedPlayerId?: string
}

export type ClaimEntry = Span & { kind: 'claim'; claimed: PieceColor }

// A piece put on the board while the players set it.
export type PlaceEntry = Span & { kind: 'place'; color: PieceColor; coords: AxialCoordinates }

export type PlayerEntry = MoveEntry | ClaimEntry | PlaceEntry

// A call, a concession or a stall ends the game with a system action of its own.
export type CallEntry = {
    kind: 'call'
    id: string
    firstIndex: number
    lastIndex: number
    action: CallGameAction
}

export type HistoryEntry = PlayerEntry | CallEntry

// A claim and the move after it make one entry. A call stands on its own, even after a claim
// whose move never came.
export function historyEntries(actions: readonly GameAction[]): HistoryEntry[] {
    const entries: HistoryEntry[] = []
    actions.forEach((action, index) => {
        const last = entries.at(-1)
        if (isCallGameAction(action)) {
            entries.push({
                kind: 'call',
                id: action.id,
                firstIndex: index,
                lastIndex: index,
                action
            })
            return
        }
        if (isPlacePiece(action)) {
            entries.push({
                kind: 'place',
                id: action.id,
                firstIndex: index,
                lastIndex: index,
                playerId: action.playerId,
                color: action.color,
                coords: action.coords
            })
            return
        }
        if (isClaimColor(action)) {
            entries.push({
                kind: 'claim',
                id: action.id,
                firstIndex: index,
                lastIndex: index,
                playerId: action.playerId,
                claimed: action.color
            })
            return
        }
        if (!isMoveStack(action)) return
        const metadata = action.metadata
        if (metadata === undefined) throw Error('A move played records its outcome')
        const move: MoveEntry = {
            kind: 'move',
            id: action.id,
            firstIndex: index,
            lastIndex: index,
            playerId: action.playerId,
            moved: metadata.moved,
            from: action.from,
            via: action.via,
            to: action.to,
            height: metadata.moved.length + metadata.landedOn.length,
            scored: metadata.scored,
            passedPlayerId: metadata.passedPlayerId
        }
        if (last?.kind === 'claim' && last.playerId === action.playerId) {
            entries[entries.length - 1] = {
                ...move,
                id: last.id,
                firstIndex: last.firstIndex,
                claimed: last.claimed
            }
            return
        }
        entries.push(move)
    })
    return entries
}
