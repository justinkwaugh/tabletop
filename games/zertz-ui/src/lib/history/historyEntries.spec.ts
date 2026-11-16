import { describe, expect, it } from 'vitest'
import { ActionSource, type AxialCoordinates, type GameAction } from '@tabletop/common'
import {
    ActionType,
    MarbleColor,
    MarbleSource,
    type Capture,
    type PlaceMarble
} from '@tabletop/zertz'
import { coordinatesToNumber } from '@tabletop/common'
import { placementSeed } from '$lib/board/marbleSeeds.js'
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
                seed: placementSeed({ q: 0, r: 0 }, 0),
                placedAt: { q: 0, r: 0 },
                fromCaptures: false,
                removedAt: { q: 3, r: 0 },
                claimed: [
                    {
                        coords: { q: 0, r: 5 },
                        marble: MarbleColor.White,
                        seed: coordinatesToNumber({ q: 0, r: 5 })
                    },
                    {
                        coords: { q: 0, r: 6 },
                        marble: MarbleColor.Black,
                        seed: coordinatesToNumber({ q: 0, r: 6 })
                    }
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
                jumperSeed: coordinatesToNumber({ q: 0, r: 0 }),
                path: [
                    { q: 0, r: 0 },
                    { q: 2, r: 0 },
                    { q: 4, r: 0 }
                ],
                captured: [
                    { color: MarbleColor.Black, seed: coordinatesToNumber({ q: 0, r: 0 }) },
                    { color: MarbleColor.White, seed: coordinatesToNumber({ q: 0, r: 0 }) }
                ]
            },
            {
                kind: 'capture',
                id: 'c',
                firstIndex: 2,
                lastIndex: 2,
                playerId: 'p1',
                jumper: MarbleColor.White,
                jumperSeed: coordinatesToNumber({ q: 2, r: 0 }),
                path: [
                    { q: 2, r: 0 },
                    { q: 4, r: 0 }
                ],
                captured: [{ color: MarbleColor.Grey, seed: coordinatesToNumber({ q: 2, r: 0 }) }]
            }
        ])
    })

    it('names each marble with the specks it had on the board', () => {
        const place = (id: string, q: number): PlaceMarble => ({
            ...placement(id, 'p0', MarbleColor.Grey, false),
            coords: { q, r: 0 }
        })
        const capture: Capture = {
            ...base('c', 'p1'),
            type: ActionType.Capture,
            from: { q: 0, r: 0 },
            to: { q: 2, r: 0 },
            metadata: {
                jumper: MarbleColor.Grey,
                over: { q: 1, r: 0 },
                captured: MarbleColor.Grey,
                continues: false
            }
        }
        const [, , jump] = historyEntries([place('a', 0), place('b', 1), capture])
        expect(jump).toMatchObject({
            jumperSeed: placementSeed({ q: 0, r: 0 }, 0),
            captured: [{ color: MarbleColor.Grey, seed: placementSeed({ q: 1, r: 0 }, 1) }]
        })
    })
})
