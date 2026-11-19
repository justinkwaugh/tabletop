import type { PlaceEntry, SwapEntry } from './historyEntries.js'

export type Segment = { kind: 'text'; text: string } | { kind: 'cell'; cell: string }

const text = (value: string): Segment => ({ kind: 'text', text: value })

// Spaces live inside text segments: Svelte trims whitespace at the edges of template blocks.
// The brief form keeps the action banner to one line; the history panel uses the full one.
export function entrySegments(entry: PlaceEntry | SwapEntry, brief = false): Segment[] {
    switch (entry.kind) {
        case 'place':
            return [
                text(` filled `),
                { kind: 'cell', cell: entry.cell },
                text(` with ${entry.color}`),
                ...(entry.joinsEdges
                    ? [text(brief ? ', winning' : `, joining both ${entry.color} edges`)]
                    : [])
            ]
        case 'swap':
            return [
                text(
                    brief
                        ? ' swapped and now plays Red'
                        : " swapped, taking Red's first stone, and now plays Red"
                )
            ]
    }
}
