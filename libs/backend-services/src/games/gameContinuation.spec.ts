import { afterEach, describe, expect, it, vi } from 'vitest'
import { Firestore, Transaction } from '@google-cloud/firestore'
import {
    assertExists,
    GameCategory,
    GameEngine,
    GameStatus,
    PlayerStatus,
    Role,
    UserStatus,
    type Game,
    type GameContinuation,
    type User,
    ordinaryPrincipal
} from '@tabletop/common'
import { ContinuationDefinition, finishForContinuation } from './tests/continuationGame.js'
import { GameService } from './gameService.js'
import { FirestoreGameStore } from '../persistence/firestore/gameStore.js'
import { RedisCacheService } from '../cache/cacheService.js'
import { UserService } from '../users/userService.js'
import { TokenService } from '../tokens/tokenService.js'
import type { TaskService } from '../tasks/taskService.js'
import type { NotificationService } from '../notifications/notificationService.js'

const definition = ContinuationDefinition
const alice: User = { id: 'alice', status: UserStatus.Active, roles: [Role.User], externalIds: [] }
const stranger: User = { ...alice, id: 'stranger' }
afterEach(() => vi.restoreAllMocks())

function fixture() {
    const firestore = new Firestore({ projectId: 'continuation-unit-test' })
    const cache: RedisCacheService = Object.create(RedisCacheService.prototype)
    const store = new FirestoreGameStore(cache, firestore)
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
        UserService.prototype,
        TokenService.prototype,
        tasks,
        notifications,
        cache,
        { synthetic: definition }
    )
    return { service, store, firestore, cache }
}

function lobby(id: string, playerIds: string[]): Game {
    return definition.runtime.initializer.initializeGame(
        {
            id,
            typeId: definition.info.id,
            ownerId: alice.id,
            isPublic: true,
            config: {},
            players: playerIds.map((playerId, index) => ({
                id: playerId,
                ...(index === 0 ? { userId: alice.id } : {}),
                name: '',
                isHuman: true,
                status: index === 0 ? PlayerStatus.Joined : PlayerStatus.Open
            }))
        },
        definition
    )
}

function finishedSource(): Game {
    const source = lobby('source', ['p1', 'p2', 'p3'])
    const { startedGame, initialState } = new GameEngine(definition.runtime).startGame(source)
    initialState.board = [7, 8, 9]
    finishForContinuation(startedGame, initialState)
    return { ...startedGame, state: initialState }
}

function sourceContinuation(): GameContinuation {
    const source = finishedSource()
    assertExists(source.state, 'The finished source has a state')
    return { previousState: source.state, previousPlayers: source.players }
}

describe('hosted game continuation', () => {
    it('captures the final state privately and lets the new lobby change its roster', async () => {
        const { service, store } = fixture()
        const source = finishedSource()
        vi.spyOn(store, 'findGameById').mockResolvedValue(source)
        const write = vi.spyOn(store, 'createGame').mockImplementation(async (game) => game)

        const created = await service.createGame({
            definition,
            game: lobby('next', ['n1', 'n2']),
            owner: ordinaryPrincipal(alice),
            options: { continueFromGameId: source.id }
        })

        expect(created.continuedFromGameId).toBe(source.id)
        expect(created.players).toHaveLength(2)
        const continuation = write.mock.calls[0]?.[1]?.continuation
        expect(continuation?.previousState).toMatchObject({ board: [7, 8, 9] })
        expect(continuation?.previousPlayers.map((player) => player.id)).toEqual(['p1', 'p2', 'p3'])
        expect(created).not.toHaveProperty('state')
    })

    it('lets one finished game be continued more than once', async () => {
        const { service, store } = fixture()
        const source = finishedSource()
        vi.spyOn(store, 'findGameById').mockResolvedValue(source)
        vi.spyOn(store, 'createGame').mockImplementation(async (game) => game)

        const [first, second] = await Promise.all(
            ['first', 'second'].map((id) =>
                service.createGame({
                    definition,
                    game: lobby(id, [`${id}-1`, `${id}-2`]),
                    owner: ordinaryPrincipal(alice),
                    options: { continueFromGameId: source.id }
                })
            )
        )

        expect([first.id, second.id]).toEqual(['first', 'second'])
        expect([first.continuedFromGameId, second.continuedFromGameId]).toEqual([
            source.id,
            source.id
        ])
        expect(source).not.toHaveProperty('continuedToGameId')
    })

    it('lets an administrator continue a game they did not play', async () => {
        const { service, store } = fixture()
        vi.spyOn(store, 'findGameById').mockResolvedValue(finishedSource())
        vi.spyOn(store, 'createGame').mockImplementation(async (game) => game)
        const admin: User = { ...stranger, id: 'admin', roles: [Role.Admin] }
        const game = lobby('next', ['n1', 'n2'])
        game.players[0].userId = admin.id

        const created = await service.createGame({
            definition,
            game,
            owner: { user: admin, adminMode: true },
            options: { continueFromGameId: 'source' }
        })

        expect(created.continuedFromGameId).toBe('source')
    })

    it('lets only a player of the finished game continue it', async () => {
        const { service, store } = fixture()
        vi.spyOn(store, 'findGameById').mockResolvedValue(finishedSource())
        const write = vi.spyOn(store, 'createGame')
        const game = lobby('next', ['n1', 'n2'])
        game.ownerId = stranger.id
        game.players[0].userId = stranger.id

        await expect(
            service.createGame({
                definition,
                game,
                owner: ordinaryPrincipal(stranger),
                options: { continueFromGameId: 'source' }
            })
        ).rejects.toThrow()
        expect(write).not.toHaveBeenCalled()
    })

    it.each([
        ['has not offered continuation', (game: Game) => delete game.state?.canContinue],
        ['is an Exploration', (game: Game) => (game.category = GameCategory.Exploration)],
        ['was deleted', (game: Game) => (game.deleted = true)]
    ])('rejects a source that %s', async (_case, change) => {
        const { service, store } = fixture()
        const source = finishedSource()
        change(source)
        vi.spyOn(store, 'findGameById').mockResolvedValue(source)
        const write = vi.spyOn(store, 'createGame')

        await expect(
            service.createGame({
                definition,
                game: lobby('next', ['n1', 'n2']),
                owner: ordinaryPrincipal(alice),
                options: { continueFromGameId: source.id }
            })
        ).rejects.toThrow()
        expect(write).not.toHaveBeenCalled()
    })

    it('rejects a title that does not support continuation', async () => {
        const { service, store } = fixture()
        vi.spyOn(store, 'findGameById').mockResolvedValue(finishedSource())
        const { supportsContinuation: _, ...initializer } = definition.runtime.initializer

        await expect(
            service.createGame({
                definition: { ...definition, runtime: { ...definition.runtime, initializer } },
                game: lobby('next', ['n1', 'n2']),
                owner: ordinaryPrincipal(alice),
                options: { continueFromGameId: 'source' }
            })
        ).rejects.toThrow('does not support continuation')
    })

    it('starts the new game from the captured state', async () => {
        const { service, store } = fixture()
        const continuation = sourceContinuation()
        const game = lobby('next', ['n1', 'n2'])
        game.continuedFromGameId = continuation.previousState.gameId
        game.status = GameStatus.WaitingToStart
        vi.spyOn(store, 'findGameById').mockResolvedValue(game)
        vi.spyOn(store, 'getContinuation').mockResolvedValue(continuation)
        vi.spyOn(store, 'updateGame').mockImplementation(async ({ fields }) => [
            { ...game, ...fields },
            [],
            game
        ])

        const started = await service.startGame({
            definition,
            gameId: game.id,
            principal: ordinaryPrincipal(alice)
        })

        expect(started.state).toMatchObject({ board: [7, 8, 9], gameId: game.id })
        expect(started.state?.result).toBeUndefined()
    })

    it('writes the continuation with the lobby in one transaction', async () => {
        const { store, firestore, cache } = fixture()
        const continuation = sourceContinuation()
        const transaction: Transaction = Object.create(Transaction.prototype)
        const create = vi.spyOn(transaction, 'create').mockReturnValue(transaction)
        vi.spyOn(firestore, 'runTransaction').mockImplementation(async (update) =>
            update(transaction)
        )
        vi.spyOn(cache, 'lockWhileWriting').mockImplementation(async (_keys, writer) =>
            writer({ addKeys: async () => {} })
        )
        const game = lobby('next', ['n1', 'n2'])

        const created = await store.createGame(game, { continuation })

        expect(create.mock.calls.map(([reference]) => reference.path)).toEqual([
            `games/${game.id}`,
            `games/${game.id}/private/continuation`
        ])
        expect(created).not.toHaveProperty('continuation')
        expect(JSON.stringify(create.mock.calls[0]?.[1])).not.toContain('previousState')
    })
})
