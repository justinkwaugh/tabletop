import { describe, expect, it } from 'vitest'
import { spaceFromName as s, spaceName } from '@tabletop/dvonn'
import { entrySegments, type Segment } from './entryText.js'
import type { HistoryEntry } from './historyEntries.js'

function read(segments: Segment[]): string {
    return segments
        .map((segment) => {
            switch (segment.kind) {
                case 'text':
                    return segment.text
                case 'space':
                    return spaceName(segment.coords)
                case 'player':
                    return segment.playerId
            }
        })
        .join('')
}

const span = { id: 'a', firstIndex: 0, lastIndex: 0, playerId: 'p' }

const move: HistoryEntry = {
    ...span,
    kind: 'move',
    from: s('D3'),
    to: s('D5'),
    moved: 2,
    landedOn: 3,
    landedOnDvonn: false,
    removedPieces: 4,
    removedStacks: 2,
    passedPlayerId: 'Bob'
}

describe('entrySegments', () => {
    it('tells the whole move in the history panel', () => {
        expect(read(entrySegments(move))).toBe(
            ' moved a stack of 2 from D3 onto a stack of 3 on D5, making 5; 4 pieces in 2 stacks cut off and removed; Bob could not move and passed'
        )
    })

    it('keeps the banner to one short line', () => {
        expect(read(entrySegments(move, true))).toBe(
            ' moved 2 from D3 onto D5 (now 5), cutting off 4'
        )
    })

    it('names a single piece and a DVONN placement', () => {
        const single: HistoryEntry = {
            ...move,
            moved: 1,
            landedOn: 1,
            removedPieces: 0,
            removedStacks: 0,
            passedPlayerId: undefined
        }
        expect(read(entrySegments(single))).toBe(
            ' moved a piece from D3 onto a piece on D5, making 2'
        )
        const place: HistoryEntry = { ...span, kind: 'place', coords: s('E3'), dvonn: true }
        expect(read(entrySegments(place))).toBe(' placed a DVONN piece on E3')
    })
})
