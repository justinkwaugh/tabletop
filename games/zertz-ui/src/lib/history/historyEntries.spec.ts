import { describe, expect, it } from 'vitest'
import { ActionSource, type AxialCoordinates, type GameAction } from '@tabletop/common'
import {
    ActionType,
    MarbleColor,
    MarbleSource,
    type Capture,
    type PlaceMarble
} from '@tabletop/zertz'
import { historyEntries } from './historyEntries.js'

const base = (id: string, playerId: string) => ({
    id,
    gameId: 'game',
    source: ActionSource.User,
    playerId
})

function placement(
    id: string,
    playerId: string,
    color: MarbleColor,
    removes: boolean,
    onPlacing: MarbleColor[] = [],
    onRemoving: MarbleColor[] = []
): PlaceMarble {
    return {
        ...base(id, playerId),
        type: ActionType.PlaceMarble,
        color,
        coords: { q: 0, r: 0 },
        ...(removes ? { remove: { q: 3, r: 0 } } : {}),
        metadata: {
            source: MarbleSource.Pool,
            claimedOnPlacing: onPlacing.map((marble, q) => ({ coords: { q, r: 5 }, marble })),
            claimedOnRemoving: onRemoving.map((marble, q) => ({ coords: { q, r: 6 }, marble }))
        }
    }
}

function jump(
    id: string,
    playerId: string,
    captured: MarbleColor,
    continues: boolean,
    from: AxialCoordinates,
    to: AxialCoordinates
): Capture {
    return {
        ...base(id, playerId),
        type: ActionType.Capture,
        from,
        to,
        metadata: { jumper: MarbleColor.White, over: from, captured, continues }
    }
}

describe('historyEntries', () => {
    it('reads a move’s placement, removal and both claims', () => {
        const actions: GameAction[] = [
            placement('a', 'p0', MarbleColor.Grey, true, [MarbleColor.White], [MarbleColor.Black])
        ]
        expect(historyEntries(actions)).toEqual([
            {
                kind: 'placement',
                id: 'a',
                firstIndex: 0,
                lastIndex: 0,
                playerId: 'p0',
                color: MarbleColor.Grey,
                placedAt: { q: 0, r: 0 },
                fromCaptures: false,
                removedAt: { q: 3, r: 0 },
                claimed: [
                    { coords: { q: 0, r: 5 }, marble: MarbleColor.White },
                    { coords: { q: 0, r: 6 }, marble: MarbleColor.Black }
                ]
            }
        ])
    })

    it('keeps a placement without a removal as its own turn', () => {
        const entries = historyEntries([
            placement('a', 'p0', MarbleColor.Grey, false),
            placement('b', 'p1', MarbleColor.White, false)
        ])
        expect(entries.map((entry) => [entry.kind, entry.playerId, entry.lastIndex])).toEqual([
            ['placement', 'p0', 0],
            ['placement', 'p1', 1]
        ])
    })

    it('groups a capture chain into one entry', () => {
        const entries = historyEntries([
            jump('a', 'p0', MarbleColor.Black, true, { q: 0, r: 0 }, { q: 2, r: 0 }),
            jump('b', 'p0', MarbleColor.White, false, { q: 2, r: 0 }, { q: 4, r: 0 }),
            jump('c', 'p1', MarbleColor.Grey, false, { q: 2, r: 0 }, { q: 4, r: 0 })
        ])
        expect(entries).toEqual([
            {
                kind: 'capture',
                id: 'a',
                firstIndex: 0,
                lastIndex: 1,
                playerId: 'p0',
                jumper: MarbleColor.White,
                path: [
                    { q: 0, r: 0 },
                    { q: 2, r: 0 },
                    { q: 4, r: 0 }
                ],
                captured: [MarbleColor.Black, MarbleColor.White]
            },
            {
                kind: 'capture',
                id: 'c',
                firstIndex: 2,
                lastIndex: 2,
                playerId: 'p1',
                jumper: MarbleColor.White,
                path: [
                    { q: 2, r: 0 },
                    { q: 4, r: 0 }
                ],
                captured: [MarbleColor.Grey]
            }
        ])
    })
})
