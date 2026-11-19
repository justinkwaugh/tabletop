import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { entrySegments, type Segment } from './entryText.js'
import type { PlaceEntry, SwapEntry } from './historyEntries.js'

function read(segments: Segment[]): string {
    return segments
        .map((segment) => (segment.kind === 'text' ? segment.text : segment.cell))
        .join('')
}

const span = { id: 'a', firstIndex: 0, lastIndex: 0, playerId: 'p' }

describe('entrySegments', () => {
    it('names the cell and its colour', () => {
        const place: PlaceEntry = {
            ...span,
            kind: 'place',
            cell: 'F6',
            color: Color.Red,
            joinsEdges: false
        }
        expect(read(entrySegments(place))).toBe(' filled F6 with red')
        expect(read(entrySegments({ ...place, joinsEdges: true }))).toBe(
            ' filled F6 with red, joining both red edges'
        )
        expect(read(entrySegments({ ...place, joinsEdges: true }, true))).toBe(
            ' filled F6 with red, winning'
        )
    })

    it('tells a swap', () => {
        const swap: SwapEntry = { ...span, kind: 'swap' }
        expect(read(entrySegments(swap, true))).toBe(' swapped and now plays Red')
    })
})
