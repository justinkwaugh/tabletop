import { describe, expect, it } from 'vitest'
import {
    ActionSource,
    CALL_GAME_ACTION_TYPE,
    GameCallKind,
    type CallGameAction
} from '@tabletop/common'
import { ActionType, PieceKind, spaceAt, type MovePiece, type PlacePiece } from '@tabletop/punct'
import { historyEntries, type HistoryEntry, type PlayerEntry } from './historyEntries.js'
import { spaceLabel } from '$lib/board/coordinates.js'
import { entrySegments } from './entryText.js'

let count = 0
function base(playerId: string) {
    count += 1
    return { id: `a${count}`, gameId: 'g', source: ActionSource.User, playerId }
}

const text = (segments: ReturnType<typeof entrySegments>) =>
    segments
        .map((segment) => {
            switch (segment.kind) {
                case 'text':
                    return segment.text
                case 'point':
                    return spaceLabel(segment.coords)
                case 'piece':
                    return `[${segment.piece}]`
                case 'player':
                    return segment.playerId
            }
        })
        .join('')

// The entries the players' own actions made, which the text describes.
function played(entries: HistoryEntry[]): PlayerEntry[] {
    return entries.flatMap((entry) => (entry.kind === 'call' ? [] : [entry]))
}

describe('history entries', () => {
    const place: PlacePiece = {
        ...base('w'),
        type: ActionType.PlacePiece,
        kind: PieceKind.Triangle,
        punct: spaceAt('C5'),
        rotation: 0,
        metadata: { pieceId: 0 }
    }

    const move = (to: string, level: number, passedPlayerId?: string): MovePiece => ({
        ...base('b'),
        type: ActionType.MovePiece,
        from: spaceAt('D8'),
        to: spaceAt(to),
        rotation: 2,
        metadata: {
            pieceId: 1,
            kind: PieceKind.StraightEnd,
            fromLevel: 0,
            level,
            ...(passedPlayerId ? { passedPlayerId } : {})
        }
    })

    it('gives each placement and move an entry', () => {
        const entries = historyEntries([place, move('D4', 1)])
        expect(entries.map((entry) => entry.kind)).toEqual(['place', 'move'])
        expect(entries[1].firstIndex).toBe(1)
    })

    it('says where a piece went and to which level, with spaces kept between words', () => {
        const [placed, moved, turned, passed] = played(
            historyEntries([place, move('D4', 1), move('D8', 0), move('D2', 0, 'w')])
        )
        expect(text(entrySegments(placed))).toBe(' placed [triangle] at C5')
        expect(text(entrySegments(moved))).toBe(' moved [straightEnd] from D8 to D4, up to level 1')
        expect(text(entrySegments(turned))).toBe(' turned [straightEnd] at D8')
        expect(text(entrySegments(passed, true))).toBe(
            ' moved [straightEnd] from D8 to D2; w passed'
        )
    })

    it('gives a called game its own entry after the last move', () => {
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
        const entries = historyEntries([place, call])
        expect(entries).toMatchObject([
            { kind: 'place', playerId: 'w', firstIndex: 0 },
            { kind: 'call', firstIndex: 1, lastIndex: 1, action: call }
        ])
    })
})
