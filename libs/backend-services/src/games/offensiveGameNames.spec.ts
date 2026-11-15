import { afterEach, describe, expect, it, vi } from 'vitest'
import { Firestore } from '@google-cloud/firestore'
import { GameStatus, PlayerStatus, Role, UserStatus, type Game, type User } from '@tabletop/common'
import { SyntheticDefinition } from './tests/syntheticGame.js'
import { GameService } from './gameService.js'
import { FirestoreGameStore } from '../persistence/firestore/gameStore.js'
import { RedisCacheService } from '../cache/cacheService.js'
import { UserService } from '../users/userService.js'
import { TokenService } from '../tokens/tokenService.js'
import type { TaskService } from '../tasks/taskService.js'
import type { NotificationService } from '../notifications/notificationService.js'

const OFFENSIVE = 'Fuck this game'

function user(id: string, roles: Role[] = [Role.User]): User {
    return {
        id,
        username: id,
        email: `${id}@example.com`,
        status: UserStatus.Active,
        roles,
        externalIds: []
    }
}

const owner = user('owner')
const admin = user('admin', [Role.User, Role.Admin])
afterEach(() => vi.restoreAllMocks())

function fixture() {
    const cache: RedisCacheService = Object.create(RedisCacheService.prototype)
    const store = new FirestoreGameStore(cache, new Firestore({ projectId: 'game-names-test' }))
    const users: UserService = Object.create(UserService.prototype)
    vi.spyOn(users, 'getUser').mockImplementation(async (id) =>
        [owner, admin].find((candidate) => candidate.id === id)
    )
    const unused = vi.fn(async () => {
        throw Error('Unexpected dependency call')
    })
    const tasks: TaskService = {
        createPushTask: unused,
        sendVerificationEmail: unused,
        sendEmailChangeVerificationEmail: unused,
        sendPasswordResetEmail: unused,
        sendAuthVerificationEmail: unused,
        sendAccountChangeNotificationEmail: unused,
        sendContentReportEmail: unused,
        sendGameInvitationEmail: unused,
        sendGameEndEmail: unused
    }
    const notifications: NotificationService = {
        addTopicTransport: vi.fn(),
        addTopicListener: unused,
        removeTopicListener: unused,
        addTransport: vi.fn(),
        registerNotificationSubscription: unused,
        unregisterNotificationSubscription: unused,
        sendNotification: vi.fn(async () => {})
    }
    const service = new GameService(
        store,
        users,
        Object.create(TokenService.prototype),
        tasks,
        notifications,
        cache,
        { synthetic: SyntheticDefinition }
    )
    vi.spyOn(store, 'createGame').mockImplementation(async (game) => game)
    return { service, store }
}

function newGame(fields: Partial<Game>, by: User): Partial<Game> {
    return {
        id: 'game',
        typeId: SyntheticDefinition.info.id,
        isPublic: true,
        config: {},
        players: [
            {
                id: 'seat-owner',
                userId: by.id,
                name: by.id,
                isHuman: true,
                status: PlayerStatus.Reserved
            },
            { id: 'seat-open', name: '', isHuman: true, status: PlayerStatus.Open },
            { id: 'seat-open-2', name: '', isHuman: true, status: PlayerStatus.Open }
        ],
        ...fields
    }
}

function waitingGame(fields: Partial<Game>): Game {
    return {
        id: 'game',
        typeId: SyntheticDefinition.info.id,
        ownerId: owner.id,
        name: 'Fine',
        isPublic: true,
        deleted: false,
        hotseat: false,
        config: {},
        createdAt: new Date(),
        winningPlayerIds: [],
        status: GameStatus.WaitingForPlayers,
        players: [
            {
                id: 'seat-owner',
                userId: owner.id,
                name: owner.id,
                isHuman: true,
                status: PlayerStatus.Joined
            }
        ],
        ...fields
    }
}

function acceptUpdates(store: FirestoreGameStore, existing: Game) {
    vi.spyOn(store, 'findGameById').mockResolvedValue(existing)
    vi.spyOn(store, 'updateGame').mockImplementation(async ({ game, fields, validator }) => {
        validator?.(game, fields)
        return [{ ...game, ...fields }, Object.keys(fields), game]
    })
}

describe('offensive names on public games', () => {
    function create(fields: Partial<Game>, by: User = owner) {
        const { service } = fixture()
        return service.createGame({
            definition: SyntheticDefinition,
            game: newGame(fields, by),
            owner: by
        })
    }

    it('refuses to create a listed public game with one', async () => {
        await expect(create({ name: OFFENSIVE })).rejects.toMatchObject({
            name: 'GameNameNotAllowedError'
        })
    })

    it('creates a listed public game with an ordinary name', async () => {
        await expect(create({ name: 'Friday game' })).resolves.toMatchObject({
            name: 'Friday game'
        })
    })

    it('leaves an unlisted game alone', async () => {
        await expect(create({ name: OFFENSIVE, unlisted: true })).resolves.toMatchObject({
            name: OFFENSIVE
        })
    })

    it('lets an administrator past a false match', async () => {
        await expect(create({ name: OFFENSIVE }, admin)).resolves.toMatchObject({ name: OFFENSIVE })
    })

    it('refuses to rename a listed public game to one', async () => {
        const { service, store } = fixture()
        acceptUpdates(store, waitingGame({}))
        await expect(
            service.updateGame({ gameId: 'game', fields: { name: OFFENSIVE }, user: owner })
        ).rejects.toMatchObject({ name: 'GameNameNotAllowedError' })
    })

    it('refuses to make an invite-only game public while it has one', async () => {
        const { service, store } = fixture()
        acceptUpdates(store, waitingGame({ name: OFFENSIVE, isPublic: false }))
        await expect(
            service.updateGame({ gameId: 'game', fields: { isPublic: true }, user: owner })
        ).rejects.toMatchObject({ name: 'GameNameNotAllowedError' })
    })

    it('lets a game named before the check be edited without changing its name', async () => {
        const { service, store } = fixture()
        acceptUpdates(store, waitingGame({ name: OFFENSIVE }))
        await expect(
            service.updateGame({
                gameId: 'game',
                fields: { name: OFFENSIVE, config: {} },
                user: owner
            })
        ).resolves.toMatchObject({ name: OFFENSIVE })
    })

    it('lets an administrator rename a listed public game to a false match', async () => {
        const { service, store } = fixture()
        acceptUpdates(store, waitingGame({}))
        await expect(
            service.updateGame({ gameId: 'game', fields: { name: OFFENSIVE }, user: admin })
        ).resolves.toMatchObject({ name: OFFENSIVE })
    })

    it('lets an invite-only game take one', async () => {
        const { service, store } = fixture()
        acceptUpdates(store, waitingGame({ isPublic: false }))
        await expect(
            service.updateGame({ gameId: 'game', fields: { name: OFFENSIVE }, user: owner })
        ).resolves.toMatchObject({ name: OFFENSIVE })
    })
})

describe('an administrator renaming a game to take its name down', () => {
    it('renames a game already in play, where the owner could not', async () => {
        const { service, store } = fixture()
        const started = waitingGame({ name: OFFENSIVE, status: GameStatus.Started })
        acceptUpdates(store, started)

        const renamed = await service.renameGameAsAdministrator({
            gameId: 'game',
            name: '  Renamed by a moderator ',
            administrator: admin
        })

        expect(renamed.name).toBe('Renamed by a moderator')
        expect(store.updateGame).toHaveBeenCalledWith(
            expect.objectContaining({ fields: { name: 'Renamed by a moderator' } })
        )
    })

    it('refuses an empty name', async () => {
        const { service, store } = fixture()
        acceptUpdates(store, waitingGame({ status: GameStatus.Started }))

        await expect(
            service.renameGameAsAdministrator({ gameId: 'game', name: '   ', administrator: admin })
        ).rejects.toThrow()
        expect(store.updateGame).not.toHaveBeenCalled()
    })
})
