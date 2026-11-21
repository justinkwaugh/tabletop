import type { AxialCoordinates } from '@tabletop/common'
import type { PieceColor } from '@tabletop/lyngk'
import { piecesForColors } from '$lib/board/pieceStyle.js'
import type { MoveEntry, PlayerEntry } from './historyEntries.js'

export type Segment =
    | { kind: 'text'; text: string }
    | { kind: 'stack'; pieces: number[] }
    | { kind: 'point'; coords: AxialCoordinates }
    | { kind: 'player'; playerId: string }

const text = (value: string): Segment => ({ kind: 'text', text: value })
const point = (coords: AxialCoordinates): Segment => ({ kind: 'point', coords })
const stack = (colors: PieceColor[]): Segment => ({
    kind: 'stack',
    pieces: piecesForColors(colors)
})

// Spaces live inside text segments: Svelte trims whitespace at the edges of template blocks.
// The brief form keeps the action banner to one line; the history panel uses the full one.
export function entrySegments(entry: PlayerEntry, brief = false): Segment[] {
    if (entry.kind === 'place') {
        return [text(' placed '), stack([entry.color]), text(' on '), point(entry.coords)]
    }
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
        ...(entry.passedPlayerId !== undefined && !brief
            ? [
                  text('; '),
                  { kind: 'player', playerId: entry.passedPlayerId } satisfies Segment,
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
