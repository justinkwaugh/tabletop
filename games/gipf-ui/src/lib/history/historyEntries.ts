import type { AxialCoordinates, GameAction } from '@tabletop/common'
import { isPushPiece, isRemoveRow } from '@tabletop/gipf'

export type Taking = {
    from: AxialCoordinates
    to: AxialCoordinates
    returned: number
    captured: number
    capturedGipf: number
}

type Span = { id: string; firstIndex: number; lastIndex: number; playerId: string }

export type PushEntry = Span & {
    kind: 'push'
    gipf: boolean
    dot: AxialCoordinates
    to: AxialCoordinates
    shifted: number
    takings: Taking[]
}

export type TakingEntry = Span & { kind: 'taking'; takings: Taking[] }

export type HistoryEntry = PushEntry | TakingEntry

function takingOf(action: GameAction): Taking | undefined {
    if (!isRemoveRow(action)) return undefined
    const removed = action.metadata?.removed ?? []
    const own = removed.filter((piece) => piece.playerId === action.playerId)
    const theirs = removed.filter((piece) => piece.playerId !== action.playerId)
    const size = (gipf: boolean) => (gipf ? 2 : 1)
    return {
        from: action.from,
        to: action.to,
        returned: own.reduce((sum, piece) => sum + size(piece.gipf), 0),
        captured: theirs.reduce((sum, piece) => sum + size(piece.gipf), 0),
        capturedGipf: theirs.filter((piece) => piece.gipf).length
    }
}

// A push and the rows its player takes after it form one entry; rows taken by the other player,
// or before a push, get their own.
export function historyEntries(actions: readonly GameAction[]): HistoryEntry[] {
    const entries: HistoryEntry[] = []
    actions.forEach((action, index) => {
        const last = entries.at(-1)
        if (isPushPiece(action)) {
            entries.push({
                kind: 'push',
                id: action.id,
                firstIndex: index,
                lastIndex: index,
                playerId: action.playerId,
                gipf: action.gipf,
                dot: action.dot,
                to: action.to,
                shifted: action.metadata?.shifted ?? 0,
                takings: []
            })
            return
        }
        const taking = takingOf(action)
        if (taking === undefined || action.playerId === undefined) return
        if (
            last !== undefined &&
            last.playerId === action.playerId &&
            last.lastIndex === index - 1
        ) {
            last.lastIndex = index
            last.takings.push(taking)
        } else {
            entries.push({
                kind: 'taking',
                id: action.id,
                firstIndex: index,
                lastIndex: index,
                playerId: action.playerId,
                takings: [taking]
            })
        }
    })
    return entries
}
