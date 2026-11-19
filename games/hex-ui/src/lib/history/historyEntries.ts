import { assertExists, isCallGameAction, type GameAction } from '@tabletop/common'
import { isPlaceStone, isSwapColors, type StoneColor } from '@tabletop/hex'

type Span = { id: string; firstIndex: number; lastIndex: number }
type Played = Span & { playerId: string }

export type PlaceEntry = Played & {
    kind: 'place'
    cell: string
    color: StoneColor
    joinsEdges: boolean
}

export type SwapEntry = Played & { kind: 'swap' }

// A game called, conceded or ended as stalled.
export type CallEntry = Span & { kind: 'call'; action: GameAction }

export type HistoryEntry = PlaceEntry | SwapEntry | CallEntry

export function historyEntries(actions: readonly GameAction[]): HistoryEntry[] {
    return actions.flatMap((action, index): HistoryEntry[] => {
        const span = { id: action.id, firstIndex: index, lastIndex: index }
        if (isPlaceStone(action)) {
            assertExists(action.metadata, 'A processed placement records its stone')
            return [
                {
                    ...span,
                    kind: 'place',
                    playerId: action.playerId,
                    cell: action.cell,
                    color: action.metadata.stone.color,
                    joinsEdges: action.metadata.joinsEdges
                }
            ]
        }
        if (isSwapColors(action)) {
            return [{ ...span, kind: 'swap', playerId: action.playerId }]
        }
        if (isCallGameAction(action)) {
            return [{ ...span, kind: 'call', action }]
        }
        return []
    })
}
