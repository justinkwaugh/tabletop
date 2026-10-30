import type { AxialCoordinates, GameAction } from '@tabletop/common'
import {
    isExtraMove,
    isMovePotential,
    isPushPiece,
    isRemoveRow,
    isSkipExtraMove,
    PieceKind
} from '@tabletop/matrx'

export type Taking = {
    from: AxialCoordinates
    to: AxialCoordinates
    returned: number
    captured: number
    capturedGipf: number
}

type Span = { id: string; firstIndex: number; lastIndex: number; playerId: string }

// A push from a dot: a GIPF piece or a stack of two from the reserve, or, for an extra move,
// the TAMSK piece from the centre.
export type PushEntry = Span & {
    kind: 'push'
    piece: PieceKind
    extra: boolean
    dot: AxialCoordinates
    to: AxialCoordinates
    shifted: number
    // Whose TAMSK stack the push put on the centre.
    tamskOwnerId?: string
    takings: Taking[]
}

export type MoveEntry = Span & {
    kind: 'move'
    piece: PieceKind
    from: AxialCoordinates
    to: AxialCoordinates
    takings: Taking[]
}

export type SkipEntry = Span & { kind: 'skip'; takings: Taking[] }

export type TakingEntry = Span & { kind: 'taking'; takings: Taking[] }

export type HistoryEntry = PushEntry | MoveEntry | SkipEntry | TakingEntry

function takingOf(action: GameAction): Taking | undefined {
    if (!isRemoveRow(action)) return undefined
    const removed = action.metadata?.removed ?? []
    const size = ({ unit }: (typeof removed)[number]) => (unit.paired ? 2 : 1)
    const own = removed.filter(({ unit }) => unit.playerId === action.playerId)
    const theirs = removed.filter(({ unit }) => unit.playerId !== action.playerId)
    const [from, to] = inReadingOrder(action.from, action.to)
    return {
        from,
        to,
        returned: own.reduce((sum, piece) => sum + size(piece), 0),
        captured: theirs.reduce((sum, piece) => sum + size(piece), 0),
        capturedGipf: theirs.filter(({ unit }) => unit.kind === PieceKind.Gipf).length
    }
}

// Rows read from the lower point to the higher: by column, then up the column.
function inReadingOrder(
    a: AxialCoordinates,
    b: AxialCoordinates
): [AxialCoordinates, AxialCoordinates] {
    const before = a.q !== b.q ? a.q < b.q : a.r > b.r
    return before ? [a, b] : [b, a]
}

function moveEntry(action: GameAction, index: number): HistoryEntry | undefined {
    if (action.playerId === undefined) return undefined
    const span = { id: action.id, firstIndex: index, lastIndex: index, playerId: action.playerId }
    if (isPushPiece(action) || isExtraMove(action)) {
        return {
            ...span,
            kind: 'push',
            piece: isPushPiece(action) ? action.kind : PieceKind.Tamsk,
            extra: isExtraMove(action),
            dot: action.dot,
            to: action.to,
            shifted: action.metadata?.shifted ?? 0,
            tamskOwnerId: action.metadata?.tamskOwnerId,
            takings: []
        }
    }
    if (isMovePotential(action)) {
        return {
            ...span,
            kind: 'move',
            piece: action.metadata?.kind ?? PieceKind.Gipf,
            from: action.from,
            to: action.to,
            takings: []
        }
    }
    if (isSkipExtraMove(action)) {
        return { ...span, kind: 'skip', takings: [] }
    }
    return undefined
}

// Each move gets an entry, and the rows its player takes right after it join it; rows taken by
// the other player, or before a move, get their own.
export function historyEntries(actions: readonly GameAction[]): HistoryEntry[] {
    const entries: HistoryEntry[] = []
    actions.forEach((action, index) => {
        const move = moveEntry(action, index)
        if (move) {
            entries.push(move)
            return
        }
        const taking = takingOf(action)
        if (taking === undefined || action.playerId === undefined) return
        const last = entries.at(-1)
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
