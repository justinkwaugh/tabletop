import { describe, expect, it } from 'vitest'
import { ActionSource } from '@tabletop/common'
import {
    ActionType,
    PieceKind,
    pointAt,
    type ExtraMove,
    type MovePotential,
    type PushPiece,
    type RemoveRow,
    type SkipExtraMove
} from '@tabletop/matrx'
import { historyEntries } from './historyEntries.js'
import { entrySegments } from './entryText.js'

let count = 0
function base(playerId: string) {
    count += 1
    return { id: `a${count}`, gameId: 'g', source: ActionSource.User, playerId }
}

const text = (segments: ReturnType<typeof entrySegments>) =>
    segments
        .map((segment) =>
            segment.kind === 'text'
                ? segment.text
                : segment.kind === 'point'
                  ? `${segment.coords.q},${segment.coords.r}`
                  : `[${segment.piece}×${segment.discs}]`
        )
        .join('')

describe('history entries', () => {
    const push: PushPiece = {
        ...base('w'),
        type: ActionType.PushPiece,
        dot: pointAt('E1'),
        to: pointAt('E2'),
        kind: PieceKind.Zertz,
        metadata: { line: [], shifted: 2, tamskOwnerId: 'w' }
    }
    const extra: ExtraMove = {
        ...base('w'),
        type: ActionType.ExtraMove,
        dot: pointAt('A3'),
        to: pointAt('B3'),
        metadata: { line: [], shifted: 0 }
    }
    const row: RemoveRow = {
        ...base('w'),
        type: ActionType.RemoveRow,
        from: pointAt('E5'),
        to: pointAt('E2'),
        keep: [],
        metadata: {
            removed: [
                {
                    coords: pointAt('E2'),
                    unit: { playerId: 'w', kind: PieceKind.Zertz, paired: true }
                },
                {
                    coords: pointAt('E6'),
                    unit: { playerId: 'b', kind: PieceKind.Gipf, paired: false }
                }
            ]
        }
    }
    const move: MovePotential = {
        ...base('b'),
        type: ActionType.MovePotential,
        from: pointAt('D6'),
        to: pointAt('G4'),
        metadata: { kind: PieceKind.Dvonn }
    }
    const skip: SkipExtraMove = { ...base('b'), type: ActionType.SkipExtraMove }

    const entries = historyEntries([push, extra, row, move, skip])

    it('gives each move an entry, with its player’s rows after it', () => {
        expect(entries.map((entry) => entry.kind)).toEqual(['push', 'push', 'move', 'skip'])
        expect(entries[1].takings).toEqual([
            {
                from: pointAt('E2'),
                to: pointAt('E5'),
                returned: 2,
                captured: 1,
                capturedGipf: 1
            }
        ])
    })

    it('says what each move did, with the spaces inside the text', () => {
        expect(text(entrySegments(entries[0]))).toBe(
            ' pushed [zertz×2] from 0,4 to 0,3, moving 2, a TAMSK stack onto E5'
        )
        expect(text(entrySegments(entries[1], true))).toBe(
            ' pushed [tamsk×1] from -4,2 to -3,2 as an extra move, taking row 0,3–0,0'
        )
        expect(text(entrySegments(entries[1]))).toContain('(2 back, captured 1 incl. 1 GIPF)')
        expect(text(entrySegments(entries[2]))).toBe(' covered with [dvonn×1] from -1,-1 onto 2,-1')
        expect(text(entrySegments(entries[3]))).toBe(' gave up the extra move')
    })
})
