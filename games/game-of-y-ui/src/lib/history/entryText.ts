import type { PlaceEntry, SwapEntry } from './historyEntries.js'

export type Segment = { kind: 'text'; text: string } | { kind: 'point'; point: string }

const text = (value: string): Segment => ({ kind: 'text', text: value })

// Spaces live inside text segments: Svelte trims whitespace at the edges of template blocks.
// The brief form keeps the action banner to one line; the history panel uses the full one.
export function entrySegments(entry: PlaceEntry | SwapEntry, brief = false): Segment[] {
    switch (entry.kind) {
        case 'place':
            return [
                text(` placed ${entry.color} on `),
                { kind: 'point', point: entry.point },
                ...(entry.formsY
                    ? [text(brief ? ', forming a Y' : ', joining all three sides')]
                    : [])
            ]
        case 'swap':
            // Worded to read with a name or with "You": "swapped to Black", never "plays".
            return [
                text(brief ? ' swapped to Black' : " swapped to Black, taking Black's first stone")
            ]
    }
}
