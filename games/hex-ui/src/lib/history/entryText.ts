import { Color } from '@tabletop/common'
import type { StoneColor } from '@tabletop/hex'
import type { PlaceEntry, SwapEntry } from './historyEntries.js'

export type Segment = { kind: 'text'; text: string } | { kind: 'cell'; cell: string }

const text = (value: string): Segment => ({ kind: 'text', text: value })

// Spaces live inside text segments: Svelte trims whitespace at the edges of template blocks.
// The brief form keeps the action banner to one line; the history panel uses the full one.
// `colorName` is what each side is called on screen.
export function entrySegments(
    entry: PlaceEntry | SwapEntry,
    brief = false,
    colorName: (color: StoneColor) => string = (color) => color
): Segment[] {
    switch (entry.kind) {
        case 'place': {
            const color = colorName(entry.color)
            return [
                text(` filled `),
                { kind: 'cell', cell: entry.cell },
                text(` with ${color}`),
                ...(entry.joinsEdges
                    ? [text(brief ? ', winning' : `, joining both ${color} edges`)]
                    : [])
            ]
        }
        case 'swap': {
            const first = colorName(Color.Red)
            const side = first.charAt(0).toUpperCase() + first.slice(1)
            return [
                text(
                    brief
                        ? ` swapped and now plays ${side}`
                        : ` swapped, taking ${side}'s first stone, and now plays ${side}`
                )
            ]
        }
    }
}
