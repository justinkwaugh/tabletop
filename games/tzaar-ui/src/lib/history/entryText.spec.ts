import { describe, expect, it } from 'vitest'
import { PieceKind, spaceFromName, spaceName } from '@tabletop/tzaar'
import { entrySegments } from './entryText.js'
import type { HistoryEntry } from './historyEntries.js'

const span = { id: 'a', firstIndex: 0, lastIndex: 0, playerId: 'alice' }

function joined(entry: HistoryEntry, brief = false): string {
    return entrySegments(entry, brief)
        .map((segment) =>
            segment.kind === 'text'
                ? segment.text
                : segment.kind === 'space'
                  ? spaceName(segment.coords)
                  : segment.playerId
        )
        .join('')
}

describe('history text', () => {
    const capture: HistoryEntry = {
        ...span,
        kind: 'capture',
        from: spaceFromName('D1'),
        to: spaceFromName('D2'),
        moved: { height: 2, kind: PieceKind.Tzarra },
        captured: { height: 1, kind: PieceKind.Tzaar },
        eliminated: PieceKind.Tzaar,
        opening: false,
        noSecondMove: false
    }

    it('tells a capture briefly in the banner and fully in the history', () => {
        expect(joined(capture, true)).toBe(' captured a Tzaar on D2, taking the last of the Tzaars')
        expect(joined(capture)).toBe(
            ' moved a Tzarra stack of 2 from D1 and captured a Tzaar on D2, taking the last of the Tzaars'
        )
    })

    it('tells a stacking with the height it makes, and who is left without a capture', () => {
        expect(
            joined({
                ...span,
                kind: 'stack',
                from: spaceFromName('C4'),
                to: spaceFromName('A2'),
                moved: { height: 1, kind: PieceKind.Tott },
                landedOn: { height: 2, kind: PieceKind.Tott },
                stuckPlayerId: 'bob'
            })
        ).toBe(' stacked a Tott from C4 onto A2, making 3; bob cannot capture and loses')
    })

    it('tells a placement and a pass', () => {
        expect(
            joined({ ...span, kind: 'place', coords: spaceFromName('E5'), piece: PieceKind.Tzarra })
        ).toBe(' placed a Tzarra on E5')
        expect(joined({ ...span, kind: 'pass' })).toBe(' passed the second move')
    })
})
