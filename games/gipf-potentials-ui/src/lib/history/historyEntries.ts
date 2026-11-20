import {
    assertExists,
    isCallGameAction,
    type AxialCoordinates,
    type CallGameAction,
    type GameAction
} from '@tabletop/common'
import {
    basicsIn,
    isExtraMove,
    isFinishRemoving,
    isMovePotential,
    isPushPiece,
    isRemoveRow,
    isSkipExtraMove,
    PieceKind,
    type PotentialCounts,
    type PotentialKind
} from '@tabletop/gipf-potentials'

export type Taking = {
    from: AxialCoordinates
    to: AxialCoordinates
    left: boolean
    returned: number
    captured: number
    capturedGipf: number
}

type Span = { id: string; firstIndex: number; lastIndex: number; playerId: string }

export type PushEntry = Span & {
    kind: 'push'
    piece: PieceKind
    extra: boolean
    forfeited?: PotentialCounts
    dot: AxialCoordinates
    to: AxialCoordinates
    shifted: number
    tamskOwnerId?: string
    takings: Taking[]
}

export type MoveEntry = Span & {
    kind: 'move'
    piece: PotentialKind
    from: AxialCoordinates
    to: AxialCoordinates
    cover?: number
    takings: Taking[]
}

export type SkipEntry = Span & { kind: 'skip'; takings: Taking[] }

export type TakingEntry = Span & { kind: 'taking'; takings: Taking[] }

export type PlayEntry = PushEntry | MoveEntry | SkipEntry | TakingEntry

// A call, a concession or a stall ends the game with a system action of its own.
export type CallEntry = {
    kind: 'call'
    id: string
    firstIndex: number
    lastIndex: number
    action: CallGameAction
}

export type HistoryEntry = PlayEntry | CallEntry

function takingsOf(action: GameAction): Taking[] {
    if (isFinishRemoving(action)) {
        assertExists(action.metadata, 'Rows left standing are recorded')
        return action.metadata.left.map((row) => {
            const [from, to] = inReadingOrder(row.from, row.to)
            return { from, to, left: true, returned: 0, captured: 0, capturedGipf: 0 }
        })
    }
    if (!isRemoveRow(action)) return []
    assertExists(action.metadata, 'A row taken records what it removed')
    const { removed } = action.metadata
    const size = ({ unit }: (typeof removed)[number]) => basicsIn(unit)
    const own = removed.filter(({ unit }) => unit.playerId === action.playerId)
    const theirs = removed.filter(({ unit }) => unit.playerId !== action.playerId)
    const [from, to] = inReadingOrder(action.from, action.to)
    return [
        {
            from,
            to,
            left: false,
            returned: own.reduce((sum, piece) => sum + size(piece), 0),
            captured: theirs.reduce((sum, piece) => sum + size(piece), 0),
            capturedGipf: theirs.filter(({ unit }) => unit.kind === PieceKind.Gipf).length
        }
    ]
}

function inReadingOrder(
    a: AxialCoordinates,
    b: AxialCoordinates
): [AxialCoordinates, AxialCoordinates] {
    const before = a.q !== b.q ? a.q < b.q : a.r > b.r
    return before ? [a, b] : [b, a]
}

function spanOf(action: GameAction, index: number) {
    assertExists(action.playerId, 'A move is made by a player')
    return { id: action.id, firstIndex: index, lastIndex: index, playerId: action.playerId }
}

function moveEntry(action: GameAction, index: number): PlayEntry | undefined {
    if (isPushPiece(action) || isExtraMove(action)) {
        assertExists(action.metadata, 'A push records what it moved on')
        return {
            ...spanOf(action, index),
            kind: 'push',
            piece: isPushPiece(action) ? action.kind : PieceKind.Tamsk,
            extra: isExtraMove(action),
            dot: action.dot,
            to: action.to,
            shifted: action.metadata.shifted,
            tamskOwnerId: action.metadata.tamskOwnerId,
            forfeited: isPushPiece(action) ? action.metadata.forfeited : undefined,
            takings: []
        }
    }
    if (isMovePotential(action)) {
        assertExists(action.metadata, "A potential's move records its kind")
        return {
            ...spanOf(action, index),
            kind: 'move',
            piece: action.metadata.kind,
            from: action.from,
            to: action.to,
            cover: action.cover,
            takings: []
        }
    }
    if (isSkipExtraMove(action)) {
        return { ...spanOf(action, index), kind: 'skip', takings: [] }
    }
    return undefined
}

// A move's own rows, taken or left standing, join its entry; any other rows get their own, and a
// call stands apart.
export function historyEntries(actions: readonly GameAction[]): HistoryEntry[] {
    const entries: HistoryEntry[] = []
    actions.forEach((action, index) => {
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
        const move = moveEntry(action, index)
        if (move) {
            entries.push(move)
            return
        }
        const takings = takingsOf(action)
        if (takings.length === 0) return
        assertExists(action.playerId, 'A row is taken by a player')
        const last = entries.at(-1)
        if (
            last !== undefined &&
            last.kind !== 'call' &&
            last.playerId === action.playerId &&
            last.lastIndex === index - 1
        ) {
            last.lastIndex = index
            last.takings.push(...takings)
        } else {
            entries.push({
                kind: 'taking',
                id: action.id,
                firstIndex: index,
                lastIndex: index,
                playerId: action.playerId,
                takings
            })
        }
    })
    return entries
}
