import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import type { Firestore } from '@google-cloud/firestore'
import { createClient, type RedisClientType } from 'redis'
import {
    GameEngine,
    GameNotificationAction,
    GameStatusCategory,
    NotificationCategory,
    PlayerStatus,
    PlayerVoteKind,
    Role,
    assertExists,
    UserNotificationAction,
    UserStatus,
    type Notification,
    type User
} from '@tabletop/common'
import { cacheFixture } from '../cache/tests/cacheFixture.js'
import { FirestoreGameStore } from '../persistence/firestore/gameStore.js'
import { isolatedFirestore } from '../persistence/firestore/tests/isolatedFirestore.js'
import { ContinuationDefinition } from './tests/continuationGame.js'
import { GameService } from './gameService.js'
import { UserService } from '../users/userService.js'
import { TokenService } from '../tokens/tokenService.js'
import type { TaskService } from '../tasks/taskService.js'
import type { NotificationService } from '../notifications/notificationService.js'
import { userTopic } from '../notifications/topics.js'
import { SeatHolderUnavailableError } from './errors.js'

function account(id: string, status = UserStatus.Active, roles = [Role.User]): User {
    return { id, username: id, email: `${id}@example.com`, status, roles, externalIds: [] }
}

const accounts = [
    account('alice'),
    account('bob'),
    account('carol'),
    account('dave', UserStatus.Inactive),
    account('admin', UserStatus.Active, [Role.User, Role.Admin])
]
const admin = accounts[4]

describe.skipIf(!process.env.CACHE_TEST_REDIS_HOST || !process.env.FIRESTORE_EMULATOR_HOST)(
    'administrator seat handover',
    () => {
        let db: Firestore
        let client: RedisClientType
        let live: ReturnType<typeof cacheFixture>
        let store: FirestoreGameStore
        let service: GameService
        let sent: { notification: Notification; topics: string[] }[]
        let gameId: string

        beforeEach(async () => {
            gameId = `replacement-${randomUUID()}`
            db = isolatedFirestore({ ignoreUndefinedProperties: true })
            client = createClient({
                socket: { host: process.env.CACHE_TEST_REDIS_HOST, reconnectStrategy: false }
            })
            await client.connect()
            live = cacheFixture(client)
            store = new FirestoreGameStore(live.cache, db)
            const users: UserService = Object.create(UserService.prototype)
            vi.spyOn(users, 'getUser').mockImplementation(async (id) =>
                accounts.find((candidate) => candidate.id === id)
            )
            vi.spyOn(users, 'getUserByUsername').mockImplementation(async (username) =>
                accounts.find((candidate) => candidate.username === username)
            )
            const unused = vi.fn(async () => {
                throw Error('Unexpected dependency call')
            })
            const tasks: TaskService = {
                createPushTask: vi.fn(async () => {}),
                sendVerificationEmail: unused,
                sendEmailChangeVerificationEmail: unused,
                sendPasswordResetEmail: unused,
                sendAuthVerificationEmail: unused,
                sendAccountChangeNotificationEmail: unused,
                sendContentReportEmail: unused,
                sendGameInvitationEmail: unused,
                sendGameEndEmail: unused,
                sendGameStartedEmail: unused
            }
            sent = []
            const notifications: NotificationService = {
                addTopicTransport: vi.fn(),
                addTopicListener: unused,
                removeTopicListener: unused,
                addTransport: vi.fn(),
                registerNotificationSubscription: unused,
                unregisterNotificationSubscription: unused,
                hasUserDirectSubscription: unused,
                sendNotification: vi.fn(async (message) => {
                    sent.push({ notification: message.notification, topics: message.topics ?? [] })
                })
            }
            service = new GameService(
                store,
                users,
                Object.create(TokenService.prototype),
                tasks,
                notifications,
                live.cache,
                { [ContinuationDefinition.info.id]: ContinuationDefinition }
            )
            const definition = ContinuationDefinition
            const lobby = definition.runtime.initializer.initializeGame(
                {
                    id: gameId,
                    typeId: definition.info.id,
                    ownerId: 'alice',
                    isPublic: false,
                    config: {},
                    players: ['alice', 'bob'].map((userId, index) => ({
                        id: `seat-${index + 1}`,
                        userId,
                        name: userId,
                        isHuman: true,
                        status: PlayerStatus.Joined
                    }))
                },
                definition
            )
            const { startedGame, initialState } = new GameEngine(definition.runtime).startGame(
                lobby
            )
            await store.createGame({ ...startedGame, state: initialState })
        })

        afterEach(async () => {
            try {
                await db.recursiveDelete(db.doc(`games/${gameId}`))
            } finally {
                vi.restoreAllMocks()
                live.cache.destroy()
                client.destroy()
                await db.terminate()
            }
        })

        it('hands the owner seat over, with the lists and notifications that follow', async () => {
            const { game, formerHolder, newHolder } = await service.handOverSeatAsAdministrator({
                gameId,
                playerId: 'seat-1',
                username: 'carol',
                administrator: admin
            })

            expect(formerHolder).toEqual({ userId: 'alice', name: 'alice' })
            expect(newHolder).toEqual({ userId: 'carol', name: 'carol' })
            const stored = await store.findGameById(gameId)
            expect(stored?.players.map(({ id, userId }) => ({ id, userId }))).toEqual([
                { id: 'seat-1', userId: 'carol' },
                { id: 'seat-2', userId: 'bob' }
            ])
            expect(stored?.ownerId).toBe('carol')
            expect(game.ownerId).toBe('carol')

            const active = (user: string) =>
                store
                    .findGamesForUser(account(user), GameStatusCategory.Active)
                    .then((games) => games.map((found) => found.id))
            expect(await active('carol')).toContain(gameId)
            expect(await active('alice')).not.toContain(gameId)

            const updateTopics = sent
                .filter(
                    ({ notification }) =>
                        notification.type === NotificationCategory.Game &&
                        notification.action === GameNotificationAction.Update
                )
                .flatMap(({ topics }) => topics)
            expect(updateTopics).toEqual(
                expect.arrayContaining(['carol', 'bob', 'alice'].map(userTopic))
            )
            expect(sent.map(({ notification }) => notification)).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        action: UserNotificationAction.TookOverSeat,
                        data: expect.objectContaining({
                            user: { id: 'carol' },
                            formerHolder: { name: 'alice' }
                        })
                    }),
                    expect.objectContaining({
                        action: UserNotificationAction.LostSeat,
                        data: expect.objectContaining({
                            user: { id: 'alice' },
                            newHolder: { name: 'carol' }
                        })
                    })
                ])
            )
        })

        it('cancels an open Player Vote', async () => {
            const current = await store.findGameById(gameId, false)
            assertExists(current, 'The game was seeded')
            await store.updateGame({
                game: current,
                fields: {
                    vote: {
                        id: 'v1',
                        kind: PlayerVoteKind.Call,
                        initiatorPlayerId: 'seat-2',
                        approvingPlayerIds: ['seat-2'],
                        decliningPlayerIds: []
                    }
                }
            })
            const { game } = await service.handOverSeatAsAdministrator({
                gameId,
                playerId: 'seat-2',
                username: 'carol',
                administrator: admin
            })
            expect(game.vote).toBeUndefined()
            expect((await store.findGameById(gameId))?.vote).toBeUndefined()
        })

        it('keeps ownership when another seat is handed over', async () => {
            const { game } = await service.handOverSeatAsAdministrator({
                gameId,
                playerId: 'seat-2',
                username: 'carol',
                administrator: admin
            })
            expect(game.ownerId).toBe('alice')
        })

        it('refuses an account that is not active', async () => {
            for (const username of ['dave', 'nobody'])
                await expect(
                    service.handOverSeatAsAdministrator({
                        gameId,
                        playerId: 'seat-2',
                        username,
                        administrator: admin
                    })
                ).rejects.toThrow(SeatHolderUnavailableError)
            expect((await store.findGameById(gameId))?.players[1]?.userId).toBe('bob')
        })
    }
)
