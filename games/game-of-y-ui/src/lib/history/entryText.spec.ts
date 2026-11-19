import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { entrySegments, type Segment } from './entryText.js'
import type { PlaceEntry, SwapEntry } from './historyEntries.js'

function read(segments: Segment[]): string {
    return segments
        .map((segment) => (segment.kind === 'text' ? segment.text : segment.point))
        .join('')
}

const span = { id: 'a', firstIndex: 0, lastIndex: 0, playerId: 'p' }

describe('entrySegments', () => {
    it('names the stone and its point', () => {
        const place: PlaceEntry = {
            ...span,
            kind: 'place',
            point: 'E5',
            color: Color.Black,
            formsY: false
        }
        expect(read(entrySegments(place))).toBe(' placed black on E5')
        expect(read(entrySegments({ ...place, formsY: true }))).toBe(
            ' placed black on E5, joining all three sides'
        )
        expect(read(entrySegments({ ...place, formsY: true }, true))).toBe(
            ' placed black on E5, forming a Y'
        )
    })

    it('tells a swap', () => {
        const swap: SwapEntry = { ...span, kind: 'swap' }
        expect(read(entrySegments(swap, true))).toBe(' swapped and now plays Black')
    })
})
