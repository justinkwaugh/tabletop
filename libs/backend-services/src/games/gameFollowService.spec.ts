import { describe, expect, it, vi } from 'vitest'
import {
    GAME_FOLLOW_LIMIT,
    GameCategory,
    GameStatus,
    PlayerStatus,
    Role,
    UserStatus,
    type Game,
    type User
} from '@tabletop/common'
import { GameFollowService } from './gameFollowService.js'
import type {
    FollowEligibilityCheck,
    GameFollow,
    GameFollowAddition
} from '../persistence/stores/gameFollowStore.js'

const follower: User = {
    id: 'follower',
    status: UserStatus.Active,
    roles: [Role.User],
    externalIds: []
}

function table(id: string, fields: Partial<Game> = {}): Game {
    return {
        id,
        typeId: 'synthetic',
        ownerId: 'owner',
        name: id,
        isPublic: true,
        deleted: false,
        hotseat: false,
        config: {},
        createdAt: new Date(),
        winningPlayerIds: [],
        status: GameStatus.Started,
        players: [
            { id: 'p1', isHuman: true, name: 'owner', userId: 'owner', status: PlayerStatus.Joined }
        ],
        ...fields
    }
}

function fixture(
    games: Game[],
    {
        refusal,
        followedIds = games.map((game) => game.id)
    }: { refusal?: 'limitReached' | 'accountUnavailable'; followedIds?: string[] } = {}
) {
    const byId = new Map(games.map((game) => [game.id, game]))
    const follows = {
        addFollow: vi.fn(
            async ({
                gameId,
                eligible
            }: GameFollow & {
                limit: number
                eligible: FollowEligibilityCheck
            }): Promise<GameFollowAddition> => {
                const game = byId.get(gameId)
                if (!game) return 'gameNotFound'
                if (!eligible(game)) return 'notFollowable'
                return refusal ?? 'added'
            }
        ),
        removeFollow: vi.fn(async (_follow: GameFollow) => undefined),
        removeIneligibleFollows: vi.fn(
            async (_prune: {
                userId: string
                gameIds: string[]
                eligible: FollowEligibilityCheck
            }) => undefined
        ),
        findFollowedGameIds: vi.fn(async () => followedIds)
    }
    const service = new GameFollowService(
        { findGamesById: async (ids) => ids.flatMap((id) => byId.get(id) ?? []) },
        follows
    )
    return { service, follows }
}

describe('following a game', () => {
    it('stores a follow on a game the user does not play in', async () => {
        const { service, follows } = fixture([table('open')])
        await service.followGame(follower, 'open')
        expect(follows.addFollow).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'follower',
                gameId: 'open',
                limit: GAME_FOLLOW_LIMIT
            })
        )
        await expect(follows.addFollow.mock.results[0].value).resolves.toBe('added')
    })

    it.each([
        ['a hotseat game', table('t', { hotseat: true })],
        ['an exploration', table('t', { category: GameCategory.Exploration })],
        [
            'a game the user plays in',
            table('t', {
                players: [
                    {
                        id: 'p1',
                        isHuman: true,
                        name: 'follower',
                        userId: 'follower',
                        status: PlayerStatus.Joined
                    }
                ]
            })
        ],
        ['a game the user owns', table('t', { ownerId: 'follower' })]
    ])('refuses %s', async (_name, game) => {
        const { service } = fixture([game])
        await expect(service.followGame(follower, 't')).rejects.toThrow('cannot be followed')
    })

    it('stores a follow on a finished game', async () => {
        const { service, follows } = fixture([table('done', { status: GameStatus.Finished })])
        await service.followGame(follower, 'done')
        expect(follows.addFollow).toHaveBeenCalled()
    })

    it('refuses a missing game', async () => {
        const { service } = fixture([])
        await expect(service.followGame(follower, 'gone')).rejects.toThrow('was not found')
    })

    it('stores a follow on a tournament table the user organises', async () => {
        const organised = table('organised', {
            ownerId: 'follower',
            tournament: {
                tournamentId: 'cup',
                stageId: 'stage',
                tableId: 'table',
                scheduleId: 'schedule'
            }
        })
        const { service, follows } = fixture([organised])
        await service.followGame(follower, 'organised')
        await expect(follows.addFollow.mock.results[0].value).resolves.toBe('added')
    })

    it('refuses a follow from an account that is no longer available', async () => {
        const { service } = fixture([table('open')], { refusal: 'accountUnavailable' })
        await expect(service.followGame(follower, 'open')).rejects.toThrow('no longer available')
    })

    it('refuses a follow past the limit', async () => {
        const { service } = fixture([table('open')], { refusal: 'limitReached' })
        await expect(service.followGame(follower, 'open')).rejects.toThrow(
            `at most ${GAME_FOLLOW_LIMIT} games`
        )
    })
})

describe('listing followed games', () => {
    it('keeps finished games and leaves out games the user has since joined', async () => {
        const { service } = fixture([
            table('running'),
            table('finished', { status: GameStatus.Finished }),
            table('joined', { ownerId: 'follower' })
        ])
        const games = await service.getFollowedGames(follower)
        expect(games.map((game) => game.id)).toEqual(['running', 'finished'])
    })

    it('asks the store to prune the follows it did not list', async () => {
        const { service, follows } = fixture(
            [
                table('running'),
                table('archived', { status: GameStatus.Archived }),
                table('joined', { ownerId: 'follower' })
            ],
            { followedIds: ['running', 'archived', 'joined', 'deleted'] }
        )
        await service.getFollowedGames(follower)
        expect(follows.removeIneligibleFollows).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'follower',
                gameIds: ['archived', 'joined', 'deleted']
            })
        )
    })

    it('still lists the games when pruning fails', async () => {
        const { service, follows } = fixture([table('running')], {
            followedIds: ['running', 'deleted']
        })
        follows.removeIneligibleFollows.mockRejectedValue(Error('unavailable'))
        vi.spyOn(console, 'error').mockImplementation(() => {})
        const games = await service.getFollowedGames(follower)
        expect(games.map((game) => game.id)).toEqual(['running'])
    })
})
