import { describe, expect, it } from 'vitest'
import { GameStatus, PlayerStatus, PlayerVoteKind, type Game } from '@tabletop/common'
import { seatHandover } from './seatHandover.js'
import {
    DuplicatePlayerError,
    GameNotInProgressError,
    HotseatSeatHandoverError,
    InvalidPlayerIdError
} from './errors.js'
import { TournamentGameError } from './tournamentGames.js'

function game(overrides: Partial<Game> = {}): Game {
    return {
        id: 'g1',
        typeId: 'synthetic',
        status: GameStatus.Started,
        isPublic: false,
        deleted: false,
        ownerId: 'alice',
        name: 'Game',
        players: [
            {
                id: 's1',
                userId: 'alice',
                name: 'Alice',
                isHuman: true,
                status: PlayerStatus.Joined
            },
            { id: 's2', userId: 'bob', name: 'Bob', isHuman: true, status: PlayerStatus.Joined },
            { id: 's3', name: 'Bot', isHuman: false, status: PlayerStatus.Joined }
        ],
        config: {},
        hotseat: false,
        createdAt: new Date(0),
        winningPlayerIds: [],
        ...overrides
    }
}

const carol = { userId: 'carol', name: 'Carol' }

describe('seatHandover', () => {
    it('seats the new holder in the same Player and leaves the others alone', () => {
        const { changes, formerHolder } = seatHandover(game(), 's2', carol)
        expect(changes.players.map(({ id, userId, name }) => ({ id, userId, name }))).toEqual([
            { id: 's1', userId: 'alice', name: 'Alice' },
            { id: 's2', userId: 'carol', name: 'Carol' },
            { id: 's3', userId: undefined, name: 'Bot' }
        ])
        expect(changes.ownerId).toBe('alice')
        expect(formerHolder).toEqual({ userId: 'bob', name: 'Bob' })
    })

    it('passes ownership with the owner seat', () => {
        expect(seatHandover(game(), 's1', carol).changes.ownerId).toBe('carol')
    })

    it('cancels an open Player Vote', () => {
        const voting = game({
            vote: {
                id: 'v1',
                kind: PlayerVoteKind.Call,
                initiatorPlayerId: 's2',
                approvingPlayerIds: ['s2'],
                decliningPlayerIds: []
            }
        })
        const { changes } = seatHandover(voting, 's2', carol)
        expect(changes).toHaveProperty('vote', undefined)
    })

    it('refuses games that are not in progress', () => {
        for (const status of [GameStatus.WaitingForPlayers, GameStatus.Finished])
            expect(() => seatHandover(game({ status }), 's2', carol)).toThrow(
                GameNotInProgressError
            )
    })

    it('refuses tournament and hotseat games', () => {
        const tournament = game({
            tournament: { tournamentId: 't', stageId: 's', scheduleId: 'x', tableId: '1' }
        })
        expect(() => seatHandover(tournament, 's2', carol)).toThrow(TournamentGameError)
        expect(() => seatHandover(game({ hotseat: true }), 's2', carol)).toThrow(
            HotseatSeatHandoverError
        )
    })

    it('refuses a Player without an account', () => {
        for (const playerId of ['s3', 'missing'])
            expect(() => seatHandover(game(), playerId, carol)).toThrow(InvalidPlayerIdError)
    })

    it('refuses an account already seated', () => {
        expect(() => seatHandover(game(), 's2', { userId: 'alice', name: 'Alice' })).toThrow(
            DuplicatePlayerError
        )
    })
})
