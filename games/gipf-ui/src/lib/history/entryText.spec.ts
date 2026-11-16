import { describe, expect, it } from 'vitest'
import { entrySegments, type Segment } from './entryText.js'
import type { HistoryEntry } from './historyEntries.js'

function read(segments: Segment[]): string {
    return segments
        .map((segment) => {
            switch (segment.kind) {
                case 'text':
                    return segment.text
                case 'piece':
                    return segment.gipf ? '[GIPF]' : '[piece]'
                case 'point':
                    return `${segment.coords.q},${segment.coords.r}`
            }
        })
        .join('')
}

const span = { id: 'a', firstIndex: 0, lastIndex: 1, playerId: 'w' }
const row = { from: { q: -3, r: 1 }, to: { q: 0, r: 1 }, returned: 4, captured: 2, capturedGipf: 1 }

const push: HistoryEntry = {
    ...span,
    kind: 'push',
    gipf: false,
    dot: { q: -4, r: 1 },
    to: { q: -3, r: 1 },
    shifted: 1,
    takings: [row]
}

describe('entrySegments', () => {
    it('gives the history panel every detail', () => {
        expect(read(entrySegments(push))).toBe(
            ' pushed [piece] from -4,1 to -3,1, moving 1, then took -3,1–0,1 (4 back, captured 2 incl. 1 GIPF)'
        )
    })

    it('keeps the banner brief', () => {
        expect(read(entrySegments(push, true))).toBe(
            ' pushed [piece] from -4,1 to -3,1, taking row -3,1–0,1'
        )
        expect(read(entrySegments({ ...push, takings: [] }, true))).toBe(
            ' pushed [piece] from -4,1 to -3,1'
        )
        expect(read(entrySegments({ ...span, kind: 'taking', takings: [row, row] }, true))).toBe(
            ' took rows -3,1–0,1 and -3,1–0,1'
        )
    })
})
