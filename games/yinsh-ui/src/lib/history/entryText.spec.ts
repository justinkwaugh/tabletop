import { describe, expect, it } from 'vitest'
import { pointFromName as p, pointName } from '@tabletop/yinsh'
import { entrySegments, type Segment } from './entryText.js'
import type { HistoryEntry } from './historyEntries.js'

function read(segments: Segment[]): string {
    return segments
        .map((segment) => {
            switch (segment.kind) {
                case 'text':
                    return segment.text
                case 'point':
                    return pointName(segment.coords)
                case 'player':
                    return segment.playerId
            }
        })
        .join('')
}

const span = { id: 'a', firstIndex: 0, lastIndex: 3, playerId: 'p' }

const move: HistoryEntry = {
    ...span,
    kind: 'move',
    from: p('F3'),
    to: p('F9'),
    flipped: 3,
    removals: [{ from: p('B3'), to: p('F3'), ring: p('F9'), ringsRemoved: 2 }],
    opponentPassed: true,
    opponentId: 'bob'
}

describe('entrySegments', () => {
    it('gives the history panel every detail', () => {
        expect(read(entrySegments(move))).toBe(
            ' moved a ring from F3 to F9, flipping 3 markers; removed the row B3–F3 and the ring on F9 (second ring); bob could not move and passed'
        )
    })

    it('keeps the banner brief', () => {
        expect(read(entrySegments(move, true))).toBe(' moved F3 to F9, flipping 3 and took a row')
    })

    it('names a plain move and a placement', () => {
        const plain: HistoryEntry = { ...move, flipped: 0, removals: [], opponentPassed: false }
        expect(read(entrySegments(plain))).toBe(' moved a ring from F3 to F9')
        expect(read(entrySegments({ ...span, kind: 'place', coords: p('E5') }))).toBe(
            ' placed a ring on E5'
        )
    })

    it('describes the rows a move made for the opponent', () => {
        const take: HistoryEntry = {
            ...span,
            kind: 'take',
            removals: [{ from: p('B3'), to: p('F3'), ring: p('K10'), ringsRemoved: 1 }]
        }
        expect(read(entrySegments(take))).toBe(
            ' removed the row B3–F3 and the ring on K10 (first ring)'
        )
        expect(read(entrySegments(take, true))).toBe(' took a row')
    })
})
