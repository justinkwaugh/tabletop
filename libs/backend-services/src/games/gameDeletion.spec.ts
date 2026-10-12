import { afterEach, describe, expect, it, vi } from 'vitest'
import { Firestore } from '@google-cloud/firestore'
import { GameStatus, PlayerStatus, Role, UserStatus, type Game, type User } from '@tabletop/common'
import { GameService } from './gameService.js'
import { FirestoreGameStore } from '../persistence/firestore/gameStore.js'
import { RedisCacheService } from '../cache/cacheService.js'
import { UserService } from '../users/userService.js'
import { TokenService } from '../tokens/tokenService.js'
import { LocalTaskService } from '../tasks/localTasksService.js'
import { DefaultNotificationService } from '../notifications/defaultNotificationService.js'
import { SyntheticDefinition } from './tests/syntheticGame.js'

const owner: User = {
    id: 'owner',
    username: 'owner',
    status: UserStatus.Active,
    roles: [Role.User],
    externalIds: []
}
const opponent: User = { ...owner, id: 'opponent', username: 'opponent' }
const admin: User = { ...owner, id: 'admin', username: 'admin', roles: [Role.User, Role.Admin] }

afterEach(() => vi.restoreAllMocks())

function fixture(read: Partial<Game>, stored: Partial<Game> = read) {
    const game: Game = {
        id: 'game',
        typeId: 'synthetic',
        ownerId: owner.id,
        name: 'Game',
        isPublic: true,
        deleted: false,
        hotseat: false,
        config: {},
        createdAt: new Date(),
        winningPlayerIds: [],
        status: GameStatus.Started,
        players: [owner, opponent].map((user, index) => ({
            id: `p${index}`,
            isHuman: true,
            name: user.id,
            userId: user.id,
            status: PlayerStatus.Joined
        })),
        ...read
    }
    const cache: RedisCacheService = Object.create(RedisCacheService.prototype)
    const store = new FirestoreGameStore(cache, new Firestore({ projectId: 'deletion-unit-test' }))
    vi.spyOn(store, 'findGameById').mockResolvedValue(game)
    const deleted = vi.fn()
    const deleteGame = vi
        .spyOn(store, 'deleteGame')
        .mockImplementation(async (_game, authorize) => {
            authorize?.({ ...game, ...stored })
            deleted()
        })
    const notifications: DefaultNotificationService = Object.create(
        DefaultNotificationService.prototype
    )
    vi.spyOn(notifications, 'sendNotification').mockResolvedValue()
    const service = new GameService(
        store,
        UserService.prototype,
        TokenService.prototype,
        LocalTaskService.prototype,
        notifications,
        cache,
        { synthetic: SyntheticDefinition }
    )
    return { service, deleteGame, deleted, game }
}

const REFUSAL = 'can only be deleted by an administrator'

describe('deleting a Hosted Game', () => {
    it.each([GameStatus.WaitingForPlayers, GameStatus.WaitingToStart, GameStatus.Started])(
        'lets the Game Owner delete a game that is %s',
        async (status) => {
            const { service, deleted, game } = fixture({ status })
            await service.deleteGame(owner, game.id)
            expect(deleted).toHaveBeenCalledTimes(1)
        }
    )

    it('refuses to let the Game Owner delete a Finished game', async () => {
        const { service, deleted, game } = fixture({ status: GameStatus.Finished })
        await expect(service.deleteGame(owner, game.id)).rejects.toThrow(REFUSAL)
        expect(deleted).not.toHaveBeenCalled()
    })

    it('refuses to let the Game Owner delete a game reopened by Undo after it was Finished', async () => {
        const { service, deleted, game } = fixture({
            status: GameStatus.Started,
            everFinished: true
        })
        await expect(service.deleteGame(owner, game.id)).rejects.toThrow(REFUSAL)
        expect(deleted).not.toHaveBeenCalled()
    })

    it('judges the game as stored when it is deleted, not as first read', async () => {
        const { service, deleted, game } = fixture(
            { status: GameStatus.Started },
            { status: GameStatus.Finished, everFinished: true }
        )
        await expect(service.deleteGame(owner, game.id)).rejects.toThrow(REFUSAL)
        expect(deleted).not.toHaveBeenCalled()
    })

    it.each([
        { status: GameStatus.Finished },
        { status: GameStatus.Started, everFinished: true } as const
    ])('lets an Administrator delete a game that has been Finished ($status)', async (read) => {
        const { service, deleted, game } = fixture(read)
        await service.deleteGame(admin, game.id)
        expect(deleted).toHaveBeenCalledTimes(1)
    })

    it('refuses a Player who is neither the Game Owner nor an Administrator', async () => {
        const { service, deleteGame, game } = fixture({ status: GameStatus.Started })
        await expect(service.deleteGame(opponent, game.id)).rejects.toThrow('not authorized')
        expect(deleteGame).not.toHaveBeenCalled()
    })
})
