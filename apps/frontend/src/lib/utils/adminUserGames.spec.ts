import { describe, expect, it } from 'vitest'
import { GameStatus, PlayerStatus, type Game, type Player } from '@tabletop/common'
import { adminGameSeatNote, adminGameSeatsLabel } from './adminUserGames'

function seat(id: string, status: PlayerStatus, userId?: string): Player {
    return { id, userId, name: id, status, isHuman: true }
}

function game(overrides: Partial<Game> = {}): Game {
    return {
        id: 'game',
        name: 'game',
        typeId: 'test',
        ownerId: 'owner',
        status: GameStatus.Started,
        isPublic: false,
        deleted: false,
        hotseat: false,
        config: {},
        createdAt: new Date('2026-09-01'),
        activePlayerIds: ['p1'],
        winningPlayerIds: [],
        players: [
            seat('p1', PlayerStatus.Joined, 'user'),
            seat('p2', PlayerStatus.Joined, 'other')
        ],
        ...overrides
    }
}

describe('adminGameSeatNote', () => {
    it('marks a game where it is the user’s turn', () => {
        expect(adminGameSeatNote(game(), 'user')).toBe('their turn')
        expect(adminGameSeatNote(game({ activePlayerIds: ['p2'] }), 'user')).toBeUndefined()
    })

    it('leaves the turn unmarked in hotseat, where the owner plays every seat', () => {
        expect(adminGameSeatNote(game({ hotseat: true }), 'user')).toBeUndefined()
    })

    it('marks a finished game the user won', () => {
        const finished = game({ status: GameStatus.Finished, winningPlayerIds: ['p1'] })
        expect(adminGameSeatNote(finished, 'user')).toBe('won')
    })

    it('tells an unanswered or declined invitation from a seat the user plays', () => {
        const invited = game({
            status: GameStatus.WaitingForPlayers,
            players: [seat('p1', PlayerStatus.Reserved, 'user')]
        })
        const declined = game({
            status: GameStatus.WaitingForPlayers,
            players: [seat('p1', PlayerStatus.Declined, 'user')]
        })
        expect(adminGameSeatNote(invited, 'user')).toBe('invited')
        expect(adminGameSeatNote(declined, 'user')).toBe('declined')
    })

    it('marks a game the user owns without a seat', () => {
        expect(adminGameSeatNote(game(), 'owner')).toBe('owner, not seated')
    })
})

describe('adminGameSeatsLabel', () => {
    it('counts only joined seats while seats are still open', () => {
        const waiting = game({
            status: GameStatus.WaitingForPlayers,
            players: [
                seat('p1', PlayerStatus.Joined, 'user'),
                seat('p2', PlayerStatus.Open),
                seat('p3', PlayerStatus.Reserved, 'other')
            ]
        })
        expect(adminGameSeatsLabel(waiting)).toBe('1 of 3 seats filled')
        expect(adminGameSeatsLabel(game())).toBe('2 players')
    })
})
