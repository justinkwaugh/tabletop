import {
    assertExists,
    isCallGameAction,
    type AxialCoordinates,
    type CallGameAction,
    type GameAction
} from '@tabletop/common'
import { isMoveRing, isPlaceRing, isRemoveRing, isRemoveRow } from '@tabletop/yinsh'

type Span = { id: string; firstIndex: number; lastIndex: number; playerId: string }

export type Removal = {
    from: AxialCoordinates
    to: AxialCoordinates
    // The ring taken for the row, once its removal is in the list.
    ring?: { coords: AxialCoordinates; ringsRemoved: number }
}

// The player whose turn the entry's last action skipped, as they could not move.
type Passing = { passedPlayerId?: string }

export type PlaceEntry = Span & { kind: 'place'; coords: AxialCoordinates }

export type MoveEntry = Span &
    Passing & {
        kind: 'move'
        from: AxialCoordinates
        to: AxialCoordinates
        flipped: number
        removals: Removal[]
    }

// Rows a move made for the opponent, which they take before their own move.
export type TakeEntry = Span & Passing & { kind: 'take'; removals: Removal[] }

// A ring removed for a row the listed actions do not hold: a game whose history starts at a
// checkpoint can begin between the two.
export type RingEntry = Span &
    Passing & { kind: 'ring'; ring: { coords: AxialCoordinates; ringsRemoved: number } }

export type PlayerEntry = PlaceEntry | MoveEntry | TakeEntry | RingEntry

// A call, a concession or a stall ends the game with a system action of its own.
export type CallEntry = {
    kind: 'call'
    id: string
    firstIndex: number
    lastIndex: number
    action: CallGameAction
}

export type HistoryEntry = PlayerEntry | CallEntry

// A move and the rows and rings its player takes after it make one entry; the opponent's rows
// from that move make another. The action that ends a turn records a pass that follows it. A
// call stands on its own, even after a row whose ring never came.
export function historyEntries(actions: readonly GameAction[]): HistoryEntry[] {
    const entries: HistoryEntry[] = []
    actions.forEach((action, index) => {
        const span = { id: action.id, firstIndex: index, lastIndex: index }
        const last = entries.at(-1)
        if (isCallGameAction(action)) {
            entries.push({ ...span, kind: 'call', action })
        } else if (isPlaceRing(action)) {
            entries.push({
                ...span,
                kind: 'place',
                playerId: action.playerId,
                coords: action.coords
            })
        } else if (isMoveRing(action)) {
            assertExists(action.metadata, 'A processed move records its flips')
            entries.push({
                ...span,
                kind: 'move',
                playerId: action.playerId,
                from: action.from,
                to: action.to,
                flipped: action.metadata.flipped.length,
                removals: [],
                passedPlayerId: action.metadata.passedPlayerId
            })
        } else if (isRemoveRow(action)) {
            const removal = { from: action.from, to: action.to }
            if (
                (last?.kind === 'move' || last?.kind === 'take') &&
                last.playerId === action.playerId
            ) {
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
        } else if (isRemoveRing(action)) {
            assertExists(action.metadata, 'A processed removal records the rings removed')
            const ring = { coords: action.coords, ringsRemoved: action.metadata.ringsRemoved }
            const { passedPlayerId } = action.metadata
            // Rule G3: each row taken costs a ring, which follows it.
            const owner = last?.kind === 'move' || last?.kind === 'take' ? last : undefined
            const removal = owner?.removals.at(-1)
            if (owner !== undefined && removal !== undefined) {
                removal.ring = ring
                owner.lastIndex = index
                owner.passedPlayerId = passedPlayerId
            } else {
                entries.push({
                    ...span,
                    kind: 'ring',
                    playerId: action.playerId,
                    ring,
                    passedPlayerId
                })
            }
        }
    })
    return entries
}
