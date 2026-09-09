import { Firestore, Query, Transaction } from '@google-cloud/firestore'
import { createClient, type RedisClientType } from 'redis'
import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi, type MockInstance } from 'vitest'
import {
    assertExists,
    GameStatus,
    PlayerStatus,
    Role,
    UserStatus,
    createGameFork,
    type Tournament,
    type User
} from '@tabletop/common'
import { cacheFixture } from '../cache/tests/cacheFixture.js'
import { FirestoreGameStore } from '../persistence/firestore/gameStore.js'
import { FirestoreTournamentStore } from '../persistence/firestore/tournamentStore.js'
import { GameService } from '../games/gameService.js'
import { UserService } from '../users/userService.js'
import { TokenService } from '../tokens/tokenService.js'
import { LocalTaskService } from '../tasks/localTasksService.js'
import { DefaultNotificationService } from '../notifications/defaultNotificationService.js'
import { SyntheticDefinition, SyntheticRuntime } from '../games/tests/syntheticGame.js'
import { TournamentService } from './tournamentService.js'
import { generateTournamentSchedule } from './tournamentScheduler.js'
import { UpdateValidationResult } from '../persistence/stores/validator.js'
import { tournamentGameId } from '../games/tournamentGames.js'

const definition = {
    ...SyntheticDefinition,
    runtime: { ...SyntheticRuntime, randomnessVersion: 1 as const }
}

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST || !process.env.CACHE_TEST_REDIS_HOST)(
    'Tournament provisioning with Firestore and Redis',
    { timeout: 15000 },
    () => {
        const prefix = `demo-provision-${randomUUID()}`
        const db = new Firestore({ projectId: prefix, ignoreUndefinedProperties: true })
        const client: RedisClientType = createClient({
            socket: { host: process.env.CACHE_TEST_REDIS_HOST, reconnectStrategy: false }
        })
        const { cache, pool, guardPool } = cacheFixture(client)
        const store = new FirestoreGameStore(cache, db, prefix)
        const tournaments = new FirestoreTournamentStore(cache, db, prefix)
        const users: User[] = Array.from({ length: 7 }, (_, index) => ({
            id: `${prefix}-user-${index}`,
            username: `Player ${index}`,
            status: UserStatus.Active,
            roles: [Role.User],
            externalIds: []
        }))
        const admin: User = {
            id: `${prefix}-admin`,
            username: 'Organizer',
            status: UserStatus.Active,
            roles: [Role.Admin],
            externalIds: []
        }
        const userService: UserService = Object.create(UserService.prototype)
        const notifications: DefaultNotificationService = Object.create(
            DefaultNotificationService.prototype
        )
        const tasks: LocalTaskService = Object.create(LocalTaskService.prototype)
        const games = new GameService(
            store,
            userService,
            TokenService.prototype,
            tasks,
            notifications,
            cache,
            { synthetic: definition }
        )
        const service = new TournamentService(
            tournaments,
            userService,
            { synthetic: definition },
            notifications,
            games
        )
        const createdIds: string[] = []
        let notify: MockInstance<DefaultNotificationService['sendNotification']>
        beforeAll(async () => {
            await client.connect()
            await Promise.all([...users, admin].map((user) => db.doc(`users/${user.id}`).set(user)))
        })
        afterEach(() => vi.restoreAllMocks())
        afterAll(async () => {
            await pool.close()
            await guardPool.close()
            for await (const keys of client.scanIterator({ MATCH: `*${prefix}*`, COUNT: 100 }))
                if (keys.length) await client.del(keys)
            for (const id of createdIds)
                for await (const keys of client.scanIterator({ MATCH: `*${id}*`, COUNT: 100 }))
                    if (keys.length) await client.del(keys)
            client.destroy()
            await db.terminate()
        })
        async function fixture() {
            vi.spyOn(userService, 'getUser').mockImplementation(async (id) =>
                [...users, admin].find((user) => user.id === id)
            )
            notify = vi.spyOn(notifications, 'sendNotification').mockResolvedValue()
            vi.spyOn(tasks, 'sendGameInvitationEmail').mockRejectedValue(
                new Error('Must not invite')
            )
            const tournament: Tournament = {
                id: `${prefix}-${randomUUID()}`,
                name: 'Mini',
                description: '',
                organizerId: admin.id,
                status: 'locked',
                revision: 1,
                createdAt: 1,
                updatedAt: 1,
                publishedAt: 1,
                lockedAt: 1,
                entrants: users.map((user) => ({ userId: user.id, joinedAt: 1 })),
                stages: [
                    { id: 'main', status: 'awaitingSchedule', rosterRevision: 1, createdAt: 1 }
                ],
                format: {
                    kind: 'mini',
                    stages: [{ id: 'main', name: 'Main', gamesPerEntrant: 3 }]
                },
                rules: {
                    titleId: 'synthetic',
                    tableSize: 3,
                    gameConfig: {},
                    concurrency: 3,
                    scoring: 'splitWinsV1',
                    registration: { kind: 'whenFull', capacity: 7 }
                }
            }
            await tournaments.create(tournament, admin)
            const schedule = generateTournamentSchedule(tournament, 42)
            const saved = await tournaments.commitSchedule(schedule, 1, admin, 2)
            const table = schedule.tables[0]
            const request = { tournamentId: tournament.id, stageId: 'main', tableId: table.id }
            const gameId = tournamentGameId(request)
            createdIds.push(gameId)
            return { tournament: saved, schedule, table, request, gameId }
        }
        it('starts the assigned game once with no invitations, private initialization data and spectator projections', async () => {
            const { request, gameId, table } = await fixture()
            const game = await service.provisionTable(request)
            expect(game.id).toBe(gameId)
            expect(game.status).toBe(GameStatus.Started)
            expect(game.players.map((player) => player.userId)).toEqual(table.entrantIds)
            expect(game.players.every((player) => player.status === PlayerStatus.Joined)).toBe(true)
            expect(game.ownerId).toBe(admin.id)
            assertExists(game.state)
            expect(game.state.turnManager.turnOrder).toEqual(
                game.players.map((player) => player.id)
            )
            expect(game.protectedInformation).toBe(true)
            const stored = await store.findGameById(gameId, true)
            expect(stored?.state).toEqual(game.state)
            const repeated = await service.provisionTable(request)
            expect(repeated.id).toBe(gameId)
            expect((await store.findGameById(gameId, true))?.state).toEqual(game.state)
            expect((await tournaments.read(request.tournamentId))?.status).toBe('inProgress')
            expect(tasks.sendGameInvitationEmail).not.toHaveBeenCalled()
            expect(JSON.stringify(notify.mock.calls)).not.toContain('masterSeed')
            const spectator = await games.getGameForUser({ gameId, user: admin })
            expect(JSON.stringify(spectator)).not.toContain('hidden-one')
            expect(JSON.stringify(spectator)).not.toContain('masterSeed')
            assertExists(spectator)
            expect(spectator.game.tournament?.tournamentId).toBe(request.tournamentId)
            expect((await db.doc(`games/${gameId}/private/initialization`).get()).exists).toBe(true)
        })
        it('shares game links with spectators, caches unchanged reads and invalidates on provisioning', async () => {
            const { request, gameId } = await fixture()
            const query = vi.spyOn(Query.prototype, 'get')
            expect(await tournaments.readGameLinks(request.tournamentId)).toEqual([])
            await vi.waitFor(async () => {
                query.mockClear()
                expect(await tournaments.readGameLinks(request.tournamentId)).toEqual([])
                expect(query).not.toHaveBeenCalled()
            })
            await service.provisionTable(request)
            const expected = [{ gameId, stageId: request.stageId, tableId: request.tableId }]
            const spectator = await service.get(request.tournamentId, admin)
            expect(spectator.games).toEqual(expected)
            await vi.waitFor(async () => {
                query.mockClear()
                expect(await tournaments.readGameLinks(request.tournamentId)).toEqual(expected)
                expect(query).not.toHaveBeenCalled()
            })
        })
        it('serializes duplicate workers and returns the same initialized state', async () => {
            const { request, gameId } = await fixture()
            const results = await Promise.all([
                service.provisionTable(request),
                service.provisionTable(request)
            ])
            expect(results.map((game) => game.id)).toEqual([gameId, gameId])
            const stored = await store.findGameById(gameId, true)
            for (const result of results)
                if (result.state) expect(result.state).toEqual(stored?.state)
            expect((await db.doc(`games/${gameId}`).collection('states').get()).size).toBe(1)
        })
        it('rolls back Game, State, seed and event transition together if creation fails', async () => {
            const { request, gameId } = await fixture()
            const create = Transaction.prototype.create
            const failing = vi.spyOn(Transaction.prototype, 'create').mockImplementation(function (
                this: Transaction,
                ref,
                data
            ) {
                if (ref.path === `games/${gameId}/private/initialization`)
                    throw new Error('Injected failure')
                return create.call(this, ref, data)
            })
            await expect(service.provisionTable(request)).rejects.toThrow()
            expect((await db.doc(`games/${gameId}`).get()).exists).toBe(false)
            expect((await db.doc(`games/${gameId}/states/${gameId}`).get()).exists).toBe(false)
            expect((await db.doc(`tournaments/${request.tournamentId}`).get()).data()?.status).toBe(
                'locked'
            )
            failing.mockRestore()
            expect((await service.provisionTable(request)).status).toBe(GameStatus.Started)
        })
        it('recovers a committed game after an acknowledgement failure without resetting play', async () => {
            const { request, gameId } = await fixture()
            const create = store.createGame.bind(store)
            const failing = vi
                .spyOn(store, 'createGame')
                .mockImplementationOnce(async (...args) => {
                    await create(...args)
                    throw new Error('Lost acknowledgement')
                })
            await expect(service.provisionTable(request)).rejects.toThrow('Lost acknowledgement')
            const before = await store.findGameById(gameId, true)
            failing.mockRestore()
            await service.provisionTable(request)
            expect((await store.findGameById(gameId, true))?.state).toEqual(before?.state)
        })
        it('rejects stale configuration, cancelled events and newly inactive entrants inside the transaction', async () => {
            const { tournament, schedule, gameId, table } = await fixture()
            await db.doc(`tournaments/${tournament.id}`).update({ status: 'cancelled' })
            await expect(
                games.provisionTournamentGame(tournament, schedule, table.id)
            ).rejects.toThrow('not available')
            expect((await db.doc(`games/${gameId}`).get()).exists).toBe(false)
            await db.doc(`tournaments/${tournament.id}`).update({ status: 'locked' })
            await db.doc(`users/${table.entrantIds[0]}`).update({ status: 'inactive' })
            try {
                await expect(
                    games.provisionTournamentGame(tournament, schedule, table.id)
                ).rejects.toThrow('active accounts')
            } finally {
                await db.doc(`users/${table.entrantIds[0]}`).update({ status: UserStatus.Active })
            }
            const changed = structuredClone(tournament)
            changed.organizerId = users[0].id
            await expect(
                games.provisionTournamentGame(changed, schedule, table.id)
            ).rejects.toThrow()
        })
        it('rejects unavailable assigned setup without creating a game and succeeds when the title returns', async () => {
            const { request, gameId } = await fixture()
            const title = vi.spyOn(games, 'getTitle').mockReturnValueOnce(undefined)
            await expect(service.provisionTable(request)).rejects.toThrow('not currently available')
            expect((await db.doc(`games/${gameId}`).get()).exists).toBe(false)
            title.mockRestore()
            expect((await service.provisionTable(request)).status).toBe(GameStatus.Started)
        })
        it('continues provisioning when the organizer is inactive without impersonating that account', async () => {
            const { request } = await fixture()
            await db.doc(`users/${admin.id}`).update({ status: 'inactive' })
            try {
                expect((await service.provisionTable(request)).ownerId).toBe(admin.id)
            } finally {
                await db.doc(`users/${admin.id}`).update({ status: UserStatus.Active })
            }
        })
        it('serializes tournament cancellation against the first game creation', async () => {
            const { request, gameId } = await fixture()
            await Promise.allSettled([
                service.provisionTable(request),
                service.cancel(request.tournamentId, admin)
            ])
            const tournament = (await db.doc(`tournaments/${request.tournamentId}`).get()).data()
            const game = await db.doc(`games/${gameId}`).get()
            expect(['cancelled', 'inProgress']).toContain(tournament?.status)
            expect(game.exists).toBe(tournament?.status === 'inProgress')
        })
        it('blocks ordinary lifecycle mutations and finished Undo, and strips tournament membership from forks', async () => {
            const { request, gameId } = await fixture()
            const game = await service.provisionTable(request)
            assertExists(game.state)
            for (const user of [users[0], admin]) {
                await expect(
                    games.updateGame({ gameId, fields: { name: 'Changed' }, owner: user })
                ).rejects.toThrow('managed by the tournament')
                await expect(games.joinGame({ gameId, user })).rejects.toThrow(
                    'managed by the tournament'
                )
                await expect(games.declineGame({ gameId, user })).rejects.toThrow(
                    'managed by the tournament'
                )
                await expect(games.deleteGame(user, gameId)).rejects.toThrow(
                    'managed by the tournament'
                )
                await expect(games.startGame({ definition, gameId, user })).rejects.toThrow(
                    'managed by the tournament'
                )
            }
            await expect(games.setGameState(game.state)).rejects.toThrow(
                'managed by the tournament'
            )
            await expect(games.createGame({ definition, game, owner: admin })).rejects.toThrow(
                'membership cannot be supplied'
            )
            await expect(
                games.updateGame({ gameId, fields: { tournament: undefined }, owner: admin })
            ).rejects.toThrow('membership cannot be changed')
            const fork = createGameFork({
                game,
                state: game.state,
                actions: [],
                actionIndex: -1,
                runtime: definition.runtime
            })
            expect(fork.game.tournament).toBeUndefined()
            expect(game.tournament).toBeDefined()
            await db.doc(`games/${gameId}`).update({ status: GameStatus.Finished })
            await expect(
                store.undoActionsFromGame({
                    gameId,
                    actions: [],
                    redoneActions: [],
                    state: game.state,
                    validator: async () => UpdateValidationResult.Proceed
                })
            ).rejects.toThrow('final')
            const read = vi.spyOn(store, 'readGameData').mockImplementation(async (_id, reader) =>
                reader({
                    game: { ...game, status: GameStatus.Finished },
                    actions: async () => [],
                    actionRange: async () => [],
                    undoWindow: async () => undefined
                })
            )
            for (const user of [users[0], admin])
                await expect(
                    games.undoAction({ definition, gameId, actionId: 'last', user })
                ).rejects.toThrow('final')
            read.mockRestore()
        })
    }
)
