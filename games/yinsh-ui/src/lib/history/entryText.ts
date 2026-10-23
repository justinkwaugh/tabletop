import type { AxialCoordinates } from '@tabletop/common'
import type { HistoryEntry, Removal } from './historyEntries.js'

export type Segment =
    | { kind: 'text'; text: string }
    | { kind: 'point'; coords: AxialCoordinates }
    | { kind: 'player'; playerId: string }

const text = (value: string): Segment => ({ kind: 'text', text: value })
const point = (coords: AxialCoordinates): Segment => ({ kind: 'point', coords })

// Spaces live inside text segments: Svelte trims whitespace at the edges of template blocks.
// The brief form keeps the action banner to one line; the history panel uses the full one.
export function entrySegments(entry: HistoryEntry, brief = false): Segment[] {
    switch (entry.kind) {
        case 'place':
            return [text(' placed a ring on '), point(entry.coords)]
        case 'take':
            return removalSegments(entry.removals, brief, true)
        case 'move':
            return [
                text(brief ? ' moved ' : ' moved a ring from '),
                point(entry.from),
                text(' to '),
                point(entry.to),
                ...flips(entry.flipped, brief),
                ...removalSegments(entry.removals, brief, false),
                ...(entry.opponentPassed && !brief
                    ? [
                          text('; '),
                          { kind: 'player', playerId: entry.opponentId } satisfies Segment,
                          text(' could not move and passed')
                      ]
                    : [])
            ]
    }
}

function flips(count: number, brief: boolean): Segment[] {
    if (count === 0) return []
    if (brief) return [text(`, flipping ${count}`)]
    return [text(`, flipping ${count} ${count === 1 ? 'marker' : 'markers'}`)]
}

function removalSegments(removals: Removal[], brief: boolean, leading: boolean): Segment[] {
    if (removals.length === 0) return []
    if (brief) {
        const rows = removals.length === 1 ? 'a row' : `${removals.length} rows`
        return [text(leading ? ` took ${rows}` : ` and took ${rows}`)]
    }
    return removals.flatMap((removal, index) => [
        text(
            leading && index === 0
                ? ' removed the row '
                : index === 0
                  ? '; removed the row '
                  : ', then the row '
        ),
        point(removal.from),
        text('–'),
        point(removal.to),
        ...(removal.ring === undefined
            ? []
            : [
                  text(' and the ring on '),
                  point(removal.ring),
                  ...(removal.ringsRemoved === undefined
                      ? []
                      : [text(` (${ordinal(removal.ringsRemoved)} ring)`)])
              ])
    ])
}

function ordinal(count: number): string {
    return ['first', 'second', 'third'][count - 1] ?? `${count}th`
}
