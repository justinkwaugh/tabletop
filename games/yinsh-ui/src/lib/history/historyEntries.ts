import type { AxialCoordinates, GameAction } from '@tabletop/common'
import { isMoveRing, isPlaceRing, isRemoveRing, isRemoveRow } from '@tabletop/yinsh'

type Span = { id: string; firstIndex: number; lastIndex: number; playerId: string }

export type Removal = {
    from: AxialCoordinates
    to: AxialCoordinates
    ring?: AxialCoordinates
    ringsRemoved?: number
}

export type PlaceEntry = Span & { kind: 'place'; coords: AxialCoordinates }

export type MoveEntry = Span & {
    kind: 'move'
    from: AxialCoordinates
    to: AxialCoordinates
    flipped: number
    removals: Removal[]
    // The opponent had no move, so this player moves again next.
    opponentPassed: boolean
    opponentId: string
}

// Rows a move made for the opponent, which they take before their own move.
export type TakeEntry = Span & { kind: 'take'; removals: Removal[] }

export type HistoryEntry = PlaceEntry | MoveEntry | TakeEntry

// A move and the rows and rings its player takes after it make one entry; the opponent's rows
// from that move make another. A player moving twice in a row means the other player passed.
export function historyEntries(
    actions: readonly GameAction[],
    opponentOf: (playerId: string) => string
): HistoryEntry[] {
    const entries: HistoryEntry[] = []
    actions.forEach((action, index) => {
        const span = { id: action.id, firstIndex: index, lastIndex: index }
        const last = entries.at(-1)
        if (isPlaceRing(action)) {
            entries.push({
                ...span,
                kind: 'place',
                playerId: action.playerId,
                coords: action.coords
            })
        } else if (isMoveRing(action)) {
            const previousMove = entries.findLast((entry) => entry.kind === 'move')
            if (previousMove?.playerId === action.playerId) {
                previousMove.opponentPassed = true
            }
            entries.push({
                ...span,
                kind: 'move',
                playerId: action.playerId,
                from: action.from,
                to: action.to,
                flipped: action.metadata?.flipped.length ?? 0,
                removals: [],
                opponentPassed: false,
                opponentId: opponentOf(action.playerId)
            })
        } else if (isRemoveRow(action)) {
            const removal = { from: action.from, to: action.to }
            if (last !== undefined && last.kind !== 'place' && last.playerId === action.playerId) {
                last.removals.push(removal)
                last.lastIndex = index
            } else {
                entries.push({
                    ...span,
                    kind: 'take',
                    playerId: action.playerId,
                    removals: [removal]
                })
            }
        } else if (isRemoveRing(action) && last !== undefined && last.kind !== 'place') {
            const removal = last.removals.at(-1)
            if (removal !== undefined) {
                removal.ring = action.coords
                removal.ringsRemoved = action.metadata?.ringsRemoved
            }
            last.lastIndex = index
        }
    })
    return entries
}
