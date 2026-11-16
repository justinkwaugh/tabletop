import { describe, expect, it } from 'vitest'
import {
    PlayerStatus,
    playersWithDeletedAccount,
    playersWithRenamedSeat,
    type Player
} from './player.js'

const seat = (id: string, name: string, userId?: string): Player => ({
    id,
    isHuman: true,
    name,
    status: PlayerStatus.Joined,
    ...(userId ? { userId } : {})
})

describe('playersWithDeletedAccount', () => {
    it('names the seat of a deleted Account with the next number in that game', () => {
        const players = [
            seat('p1', 'Alice', 'a'),
            seat('p2', 'Deleted player 1', 'b'),
            seat('p3', 'Carol', 'c')
        ]
        expect(playersWithDeletedAccount(players, 'c')?.map((player) => player.name)).toEqual([
            'Alice',
            'Deleted player 1',
            'Deleted player 2'
        ])
    })

    it('leaves a seat already renamed, and a game without the Account, unchanged', () => {
        const players = [seat('p1', 'Deleted player 1', 'a'), seat('p2', 'Bob', 'b')]
        expect(playersWithDeletedAccount(players, 'a')).toBeUndefined()
        expect(playersWithDeletedAccount(players, 'z')).toBeUndefined()
    })
})

describe('playersWithRenamedSeat', () => {
    it('renames the seat, but never one already shown as a deleted player', () => {
        const players = [seat('p1', 'Alice', 'a'), seat('p2', 'Deleted player 1', 'b')]
        expect(playersWithRenamedSeat(players, 'a', 'Alicia')?.[0].name).toBe('Alicia')
        expect(playersWithRenamedSeat(players, 'a', 'Alice')).toBeUndefined()
        expect(playersWithRenamedSeat(players, 'b', 'Bob')).toBeUndefined()
    })
})
