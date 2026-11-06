import { describe, expect, it } from 'vitest'
import { ActionSource } from '@tabletop/common'
import {
    ActionType,
    PieceKind,
    pointAt,
    type ExtraMove,
    type FinishRemoving,
    type MovePotential,
    type PushPiece,
    type RemoveRow,
    type SkipExtraMove
} from '@tabletop/gipf-potentials'
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
                  : `[${segment.discs.join('+')}]`
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
                    unit: { playerId: 'w', kind: PieceKind.Basic, discIds: [1] }
                },
                {
                    coords: pointAt('E3'),
                    unit: { playerId: 'w', kind: PieceKind.Zertz, discIds: [2] }
                },
                {
                    coords: pointAt('E6'),
                    unit: { playerId: 'b', kind: PieceKind.Gipf, discIds: [3, 4] }
                }
            ]
        }
    }
    const move: MovePotential = {
        ...base('b'),
        type: ActionType.MovePotential,
        from: pointAt('D6'),
        to: pointAt('D7'),
        metadata: {
            kind: PieceKind.Dvonn,
            landed: { playerId: 'b', kind: PieceKind.Dvonn, discIds: [5] }
        }
    }
    const skip: SkipExtraMove = { ...base('b'), type: ActionType.SkipExtraMove }

    const entries = historyEntries([push, extra, row, move, skip])

    it('gives each move an entry, with its player’s rows after it', () => {
        expect(entries.map((entry) => entry.kind)).toEqual(['push', 'push', 'move', 'skip'])
        expect(entries[1].takings).toEqual([
            {
                from: pointAt('E2'),
                to: pointAt('E5'),
                left: false,
                returned: 1,
                captured: 2,
                capturedGipf: 1
            }
        ])
    })

    it('says what each move did, with the spaces inside the text', () => {
        expect(text(entrySegments(entries[0]))).toBe(
            ' pushed [basic+zertz] from 0,4 to 0,3, moving 2, a TAMSK piece onto E5'
        )
        expect(text(entrySegments(entries[1], true))).toBe(
            ' pushed [tamsk] from -4,2 to -3,2 as an extra move, taking row 0,3–0,0'
        )
        expect(text(entrySegments(entries[1]))).toContain('(1 back, captured 2 incl. 1 GIPF)')
        expect(text(entrySegments(entries[2]))).toBe(' covered with [dvonn] from -1,-1 onto -1,-2')
        expect(text(entrySegments(entries[3]))).toBe(' gave up the extra move')
    })

    it('names the rows of GIPF-pieces a player left standing', () => {
        const pushGipf: PushPiece = {
            ...base('w'),
            type: ActionType.PushPiece,
            dot: pointAt('E1'),
            to: pointAt('E2'),
            kind: PieceKind.Gipf,
            metadata: { line: [], shifted: 3 }
        }
        const leave: FinishRemoving = {
            ...base('w'),
            type: ActionType.FinishRemoving,
            metadata: { left: [{ from: pointAt('E5'), to: pointAt('E2') }] }
        }
        const [entry] = historyEntries([pushGipf, leave])
        expect(text(entrySegments(entry))).toBe(
            ' pushed [basic+basic] from 0,4 to 0,3, moving 3, then left 0,3–0,0 standing'
        )
        expect(text(entrySegments(entry, true))).toBe(
            ' pushed [basic+basic] from 0,4 to 0,3, leaving row 0,3–0,0 standing'
        )
        const [alone] = historyEntries([leave])
        expect(text(entrySegments(alone, true))).toBe(' left row 0,3–0,0 standing')
    })
})
