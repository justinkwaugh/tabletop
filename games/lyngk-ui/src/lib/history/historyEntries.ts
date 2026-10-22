import type { AxialCoordinates, GameAction } from '@tabletop/common'
import { isClaimColor, isMoveStack, type PieceColor } from '@tabletop/lyngk'

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
    // The opponent had no move, so this player moves again next.
    opponentPassed: boolean
    opponentId: string
}

export type ClaimEntry = Span & { kind: 'claim'; claimed: PieceColor }

export type HistoryEntry = MoveEntry | ClaimEntry

// A claim and the move after it make one entry. A player moving twice in a row means the other
// player passed in between.
export function historyEntries(
    actions: readonly GameAction[],
    opponentOf: (playerId: string) => string
): HistoryEntry[] {
    const entries: HistoryEntry[] = []
    actions.forEach((action, index) => {
        const last = entries.at(-1)
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
        const moved = action.metadata?.moved ?? []
        const move: MoveEntry = {
            kind: 'move',
            id: action.id,
            firstIndex: index,
            lastIndex: index,
            playerId: action.playerId,
            moved,
            from: action.from,
            via: action.via,
            to: action.to,
            height: moved.length + (action.metadata?.landedOn.length ?? 0),
            scored: action.metadata?.scored ?? false,
            opponentPassed: false,
            opponentId: opponentOf(action.playerId)
        }
        const previousMove = entries.findLast((entry) => entry.kind === 'move')
        if (previousMove?.kind === 'move' && previousMove.playerId === action.playerId) {
            previousMove.opponentPassed = true
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
