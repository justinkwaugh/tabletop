import { describe, expect, it } from 'vitest'
import { GameCategory, GameStatus, PlayerStatus, type Game } from '@tabletop/common'
import { isUsersNonHotseatTurn, nextTurnGame } from './dashboardGames'

function game(id: string, overrides: Partial<Game> = {}): Game {
    return {
        id,
        name: id,
        typeId: 'test',
        ownerId: 'user',
        status: GameStatus.Started,
        isPublic: false,
        deleted: false,
        hotseat: false,
        config: {},
        createdAt: new Date('2026-09-01'),
        activePlayerIds: ['player'],
        winningPlayerIds: [],
        players: [
            {
                id: 'player',
                userId: 'user',
                name: 'Player',
                status: PlayerStatus.Joined,
                isHuman: true
            }
        ],
        ...overrides
    }
}

describe('next turn navigation', () => {
    it('cycles through other games and wraps regardless of input order', () => {
        const games = [game('c'), game('a'), game('b')]
        expect(nextTurnGame(games, 'a', 'user')?.id).toBe('b')
        expect(nextTurnGame(games.toReversed(), 'b', 'user')?.id).toBe('c')
        expect(nextTurnGame(games, 'c', 'user')?.id).toBe('a')
    })

    it('continues the cycle after the current game stops needing a turn', () => {
        const games = [game('a'), game('b', { activePlayerIds: [] }), game('c')]
        expect(nextTurnGame(games, 'b', 'user')?.id).toBe('c')
    })

    it('has no destination when only the current game needs a turn', () => {
        expect(nextTurnGame([game('a')], 'a', 'user')).toBeUndefined()
        expect(nextTurnGame([], 'a', 'user')).toBeUndefined()
    })

    it('excludes hotseat, exploration, finished games and other players’ turns', () => {
        const games = [
            game('a'),
            game('b', { hotseat: true }),
            game('c', { category: GameCategory.Exploration }),
            game('d', { status: GameStatus.Finished }),
            game('e', { activePlayerIds: ['opponent'] })
        ]
        expect(nextTurnGame(games, 'a', 'user')).toBeUndefined()
        expect(nextTurnGame(games, 'outside', 'spectator')).toBeUndefined()
        expect(nextTurnGame(games, 'outside')).toBeUndefined()
    })
})

describe('non-hotseat turn', () => {
    it('is the user’s turn only in a started non-hotseat game where they are active', () => {
        expect(isUsersNonHotseatTurn(game('a'), 'user')).toBe(true)
        expect(isUsersNonHotseatTurn(game('a', { hotseat: true }), 'user')).toBe(false)
        expect(isUsersNonHotseatTurn(game('a', { activePlayerIds: ['opponent'] }), 'user')).toBe(
            false
        )
        expect(isUsersNonHotseatTurn(game('a'), 'spectator')).toBe(false)
        expect(isUsersNonHotseatTurn(game('a'))).toBe(false)
    })
})
