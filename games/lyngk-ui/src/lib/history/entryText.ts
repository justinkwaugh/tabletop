import type { AxialCoordinates } from '@tabletop/common'
import type { PieceColor } from '@tabletop/lyngk'
import type { HistoryEntry, MoveEntry } from './historyEntries.js'

export type Segment =
    | { kind: 'text'; text: string }
    | { kind: 'stack'; stack: PieceColor[] }
    | { kind: 'point'; coords: AxialCoordinates }
    | { kind: 'player'; playerId: string }

const text = (value: string): Segment => ({ kind: 'text', text: value })
const point = (coords: AxialCoordinates): Segment => ({ kind: 'point', coords })
const stack = (colors: PieceColor[]): Segment => ({ kind: 'stack', stack: colors })

// Spaces live inside text segments: Svelte trims whitespace at the edges of template blocks.
// The brief form keeps the action banner to one line; the history panel uses the full one.
export function entrySegments(entry: HistoryEntry, brief = false): Segment[] {
    const claim = entry.claimed === undefined ? [] : [text(' claimed '), stack([entry.claimed])]
    if (entry.kind === 'claim') {
        return claim
    }
    const joiner = claim.length === 0 ? [] : [text(brief ? ',' : ' and')]
    const route = [entry.from, ...entry.via, entry.to].flatMap((coords, index) =>
        index === 0 ? [point(coords)] : [text(entry.via.length > 0 ? '→' : ' to '), point(coords)]
    )
    return [
        ...claim,
        ...joiner,
        text(' moved '),
        stack(entry.moved),
        text(brief || entry.via.length > 0 ? ' ' : ' from '),
        ...route,
        ...outcome(entry, brief),
        ...(entry.opponentPassed && !brief
            ? [
                  text('; '),
                  { kind: 'player', playerId: entry.opponentId } satisfies Segment,
                  text(' had to pass')
              ]
            : [])
    ]
}

function outcome(entry: MoveEntry, brief: boolean): Segment[] {
    if (entry.scored) {
        return [text(brief ? ', scoring a stack' : ', completing a stack of 5 and scoring it')]
    }
    if (entry.height >= 5) {
        return [text(`, making a stack of ${entry.height}`)]
    }
    return []
}
