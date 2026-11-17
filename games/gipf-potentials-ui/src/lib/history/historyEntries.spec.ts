import { describe, expect, it } from 'vitest'
import {
    ActionSource,
    assert,
    CALL_GAME_ACTION_TYPE,
    GameCallKind,
    type CallGameAction
} from '@tabletop/common'
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
import { historyEntries, type HistoryEntry, type PlayEntry } from './historyEntries.js'
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

function play(entry: HistoryEntry | undefined): PlayEntry {
    assert(entry !== undefined && entry.kind !== 'call', 'A move entry')
    return entry
}

describe('history entries', () => {
    const push: PushPiece = {
        ...base('w'),
        type: ActionType.PushPiece,
        dot: pointAt('E1'),
        to: pointAt('E2'),
        kind: PieceKind.Zertz,
        metadata: { shifted: 2, tamskOwnerId: 'w' }
    }
    const extra: ExtraMove = {
        ...base('w'),
        type: ActionType.ExtraMove,
        dot: pointAt('A3'),
        to: pointAt('B3'),
        metadata: { shifted: 0 }
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
            kind: PieceKind.Dvonn
        }
    }
    const skip: SkipExtraMove = { ...base('b'), type: ActionType.SkipExtraMove }

    const entries = historyEntries([push, extra, row, move, skip])

    it('gives each move an entry, with its player’s rows after it', () => {
        expect(entries.map((entry) => entry.kind)).toEqual(['push', 'push', 'move', 'skip'])
        expect(play(entries[1]).takings).toEqual([
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
        expect(text(entrySegments(play(entries[0])))).toBe(
            ' pushed [basic+zertz] from 0,4 to 0,3, moving 2, a TAMSK piece onto E5'
        )
        expect(text(entrySegments(play(entries[1]), true))).toBe(
            ' pushed [tamsk] from -4,2 to -3,2 as an extra move, taking row 0,3–0,0'
        )
        expect(text(entrySegments(play(entries[1])))).toContain('(1 back, captured 2 incl. 1 GIPF)')
        expect(text(entrySegments(play(entries[2])))).toBe(
            ' covered with [dvonn] from -1,-1 onto -1,-2'
        )
        expect(text(entrySegments(play(entries[3])))).toBe(' gave up the extra move')
    })

    it('names the potentials a plain piece gave up', () => {
        const plain: PushPiece = {
            ...base('w'),
            type: ActionType.PushPiece,
            dot: pointAt('E1'),
            to: pointAt('E2'),
            kind: PieceKind.Basic,
            metadata: {
                shifted: 0,
                forfeited: { tamsk: 0, zertz: 2, dvonn: 0, yinsh: 4, punct: 1 }
            }
        }
        const [entry] = historyEntries([plain])
        expect(text(entrySegments(play(entry)))).toContain(
            ', giving up 2 [zertz], 4 [yinsh] and 1 [punct]'
        )
        expect(text(entrySegments(play(entry), true))).not.toContain('giving up')
    })

    it('names the rows of GIPF-pieces a player left standing', () => {
        const pushGipf: PushPiece = {
            ...base('w'),
            type: ActionType.PushPiece,
            dot: pointAt('E1'),
            to: pointAt('E2'),
            kind: PieceKind.Gipf,
            metadata: { shifted: 3 }
        }
        const leave: FinishRemoving = {
            ...base('w'),
            type: ActionType.FinishRemoving,
            metadata: { left: [{ from: pointAt('E5'), to: pointAt('E2') }] }
        }
        const [entry] = historyEntries([pushGipf, leave])
        expect(text(entrySegments(play(entry)))).toBe(
            ' pushed [basic+basic] from 0,4 to 0,3, moving 3, then left 0,3–0,0 standing'
        )
        expect(text(entrySegments(play(entry), true))).toBe(
            ' pushed [basic+basic] from 0,4 to 0,3, leaving row 0,3–0,0 standing'
        )
        const [alone] = historyEntries([leave])
        expect(text(entrySegments(play(alone), true))).toBe(' left row 0,3–0,0 standing')
    })
    const call: CallGameAction = {
        id: 'call',
        gameId: 'g',
        source: ActionSource.System,
        type: CALL_GAME_ACTION_TYPE,
        call: {
            kind: GameCallKind.Conceded,
            initiatorPlayerId: 'b',
            declaredWinnerId: 'w',
            approvingPlayerIds: ['b'],
            decliningPlayerIds: []
        }
    }

    it('gives a called game its own entry after the last move', () => {
        expect(historyEntries([push, extra, row, call])).toMatchObject([
            { kind: 'push', firstIndex: 0, lastIndex: 0 },
            { kind: 'push', firstIndex: 1, lastIndex: 2 },
            { kind: 'call', firstIndex: 3, lastIndex: 3, action: call }
        ])
    })

    it('keeps a call apart from a push whose rows are still to take', () => {
        expect(historyEntries([push, call])).toMatchObject([
            { kind: 'push', firstIndex: 0, lastIndex: 0, takings: [] },
            { kind: 'call', firstIndex: 1, lastIndex: 1, action: call }
        ])
    })
})
