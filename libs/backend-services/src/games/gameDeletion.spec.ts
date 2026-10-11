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

function fixture(status: GameStatus, everFinished?: true) {
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
        status,
        everFinished,
        players: [owner, opponent].map((user, index) => ({
            id: `p${index}`,
            isHuman: true,
            name: user.id,
            userId: user.id,
            status: PlayerStatus.Joined
        }))
    }
    const cache: RedisCacheService = Object.create(RedisCacheService.prototype)
    const store = new FirestoreGameStore(cache, new Firestore({ projectId: 'deletion-unit-test' }))
    vi.spyOn(store, 'findGameById').mockResolvedValue(game)
    const deleteGame = vi.spyOn(store, 'deleteGame').mockResolvedValue()
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
    return { service, deleteGame, game }
}

describe('deleting a Hosted Game', () => {
    it.each([GameStatus.WaitingForPlayers, GameStatus.WaitingToStart, GameStatus.Started])(
        'lets the Game Owner delete a game that is %s',
        async (status) => {
            const { service, deleteGame, game } = fixture(status)
            await service.deleteGame(owner, game.id)
            expect(deleteGame).toHaveBeenCalledWith(game)
        }
    )

    it('refuses to let the Game Owner delete a Finished game', async () => {
        const { service, deleteGame, game } = fixture(GameStatus.Finished)
        await expect(service.deleteGame(owner, game.id)).rejects.toThrow(
            'can only be deleted by an administrator'
        )
        expect(deleteGame).not.toHaveBeenCalled()
    })

    it('refuses to let the Game Owner delete a game reopened by Undo after it was Finished', async () => {
        const { service, deleteGame, game } = fixture(GameStatus.Started, true)
        await expect(service.deleteGame(owner, game.id)).rejects.toThrow(
            'can only be deleted by an administrator'
        )
        expect(deleteGame).not.toHaveBeenCalled()
    })

    it.each([
        { status: GameStatus.Finished, everFinished: undefined },
        { status: GameStatus.Started, everFinished: true } as const
    ])('lets an Administrator delete a game that is $status', async ({ status, everFinished }) => {
        const { service, deleteGame, game } = fixture(status, everFinished)
        await service.deleteGame(admin, game.id)
        expect(deleteGame).toHaveBeenCalledWith(game)
    })

    it('refuses a Player who is neither the Game Owner nor an Administrator', async () => {
        const { service, deleteGame, game } = fixture(GameStatus.Started)
        await expect(service.deleteGame(opponent, game.id)).rejects.toThrow('not authorized')
        expect(deleteGame).not.toHaveBeenCalled()
    })
})
