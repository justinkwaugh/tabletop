import { describe, expect, it } from 'vitest'
import {
    ActionSource,
    assert,
    CALL_GAME_ACTION_TYPE,
    GameCallKind,
    type AxialCoordinates,
    type CallGameAction,
    type GameAction
} from '@tabletop/common'
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

const call: CallGameAction = {
    id: 'call',
    gameId: 'game',
    source: ActionSource.System,
    type: CALL_GAME_ACTION_TYPE,
    call: {
        kind: GameCallKind.Conceded,
        initiatorPlayerId: 'p1',
        declaredWinnerId: 'p0',
        approvingPlayerIds: ['p1'],
        decliningPlayerIds: []
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
        expect(entries).toMatchObject([
            { kind: 'placement', playerId: 'p0', lastIndex: 0 },
            { kind: 'placement', playerId: 'p1', lastIndex: 1 }
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
                    { color: MarbleColor.White, seed: coordinatesToNumber({ q: 2, r: 0 }) }
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

    it('names a marble placed before the state kept seeds by its ring', () => {
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
        const [jump] = historyEntries([capture])
        expect(jump).toMatchObject({
            jumperSeed: coordinatesToNumber({ q: 0, r: 0 }),
            captured: [{ color: MarbleColor.Grey, seed: coordinatesToNumber({ q: 1, r: 0 }) }]
        })
    })

    it('names a placed marble by its action number when the history starts part way through', () => {
        const actions = [{ ...placement('a', 'p1', MarbleColor.White, true), index: 12 }]
        const [entry] = historyEntries(actions)
        expect(entry.kind === 'placement' && entry.seed).toBe(placementSeed({ q: 0, r: 0 }, 12))
    })

    it('names captured and claimed marbles by the seeds their actions recorded', () => {
        const jumped = jump('j', 'p2', MarbleColor.Black, false, { q: 0, r: 0 }, { q: 2, r: 0 })
        assert(jumped.metadata)
        jumped.metadata = { ...jumped.metadata, jumperSeed: 7, capturedSeed: 8 }
        const placed = placement('a', 'p1', MarbleColor.White, true, [], [MarbleColor.Grey])
        assert(placed.metadata)
        placed.metadata.claimedOnRemoving[0].marbleSeed = 9
        const [claim, capture] = historyEntries([placed, jumped])
        expect(claim.kind === 'placement' && claim.claimed[0].seed).toBe(9)
        expect(capture.kind === 'capture' && capture.jumperSeed).toBe(7)
        expect(capture.kind === 'capture' && capture.captured[0].seed).toBe(8)
    })

    it('gives a called game its own entry after the last move', () => {
        const entries = historyEntries([placement('a', 'p0', MarbleColor.Grey, false), call])
        expect(entries).toMatchObject([
            { kind: 'placement', playerId: 'p0', firstIndex: 0 },
            { kind: 'call', firstIndex: 1, lastIndex: 1, action: call }
        ])
    })

    it('keeps a call apart from a capture chain left unfinished', () => {
        const entries = historyEntries([
            jump('a', 'p0', MarbleColor.Black, true, { q: 0, r: 0 }, { q: 2, r: 0 }),
            call
        ])
        expect(entries).toMatchObject([
            {
                kind: 'capture',
                firstIndex: 0,
                lastIndex: 0,
                path: [
                    { q: 0, r: 0 },
                    { q: 2, r: 0 }
                ]
            },
            { kind: 'call', firstIndex: 1, lastIndex: 1, action: call }
        ])
    })
})
