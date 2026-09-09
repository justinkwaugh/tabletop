import { Firestore, Query, Transaction } from '@google-cloud/firestore'
import { createClient, type RedisClientType } from 'redis'
import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi, type MockInstance } from 'vitest'
import {
    assertExists,
    GameStatus,
    GameResult,
    NotificationCategory,
    ActionSource,
    Color,
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
    info: {
        ...SyntheticDefinition.info,
        metadata: { ...SyntheticDefinition.info.metadata, maxPlayers: 4 }
    },
    runtime: {
        ...SyntheticRuntime,
        playerColors: [Color.Red, Color.Blue, Color.Green, Color.Yellow],
        randomnessVersion: 1 as const
    }
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
        const users: User[] = Array.from({ length: 8 }, (_, index) => ({
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
        const enqueue = vi.fn(async () => undefined)
        const service = new TournamentService(
            tournaments,
            userService,
            { synthetic: definition },
            notifications,
            games,
            { createPushTask: enqueue }
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
            for (const collection of await db.listCollections())
                await db.recursiveDelete(collection)
            await db.terminate()
        })
        async function fixture(
            tableSize = 3,
            capacity = 7,
            concurrency = tableSize,
            gamesPerEntrant = tableSize
        ) {
            enqueue.mockReset()
            enqueue.mockResolvedValue(undefined)
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
                entrants: users
                    .slice(0, capacity)
                    .map((user) => ({ userId: user.id, joinedAt: 1 })),
                stages: [
                    { id: 'main', status: 'awaitingSchedule', rosterRevision: 1, createdAt: 1 }
                ],
                format: {
                    kind: 'mini',
                    stages: [{ id: 'main', name: 'Main', gamesPerEntrant }]
                },
                rules: {
                    titleId: 'synthetic',
                    tableSize,
                    gameConfig: {},
                    concurrency,
                    scoring: 'splitWinsV1',
                    registration: { kind: 'whenFull', capacity }
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
        async function readyTournament(concurrency = 4) {
            const { tournament } = await fixture(4, 7, concurrency)
            let now = Date.now()
            const timed = new TournamentService(
                tournaments,
                userService,
                { synthetic: definition },
                notifications,
                games,
                { createPushTask: enqueue },
                () => now
            )
            const id = `${tournament.id}-atomic-start`
            await timed.create(id, tournament, admin)
            await timed.publish(id, admin)
            for (const user of users.slice(0, 7)) await timed.join(id, user)
            const pending = await tournaments.read(id)
            assertExists(pending?.startId)
            now += 60_000
            return { id, timed, task: { tournamentId: id, startId: pending.startId } }
        }

        it.each([
            [1, 1],
            [4, 7]
        ])(
            'saves roster, schedule and reservations together without account lookups (limit %i, tables %i)',
            async (concurrency, initialTables) => {
                const { id, timed, task } = await readyTournament(concurrency)
                await tournaments.list(admin, { scope: 'open' })
                const updates = vi.spyOn(tournaments, 'update')
                const transactions = vi.spyOn(db, 'runTransaction')
                vi.mocked(userService.getUser).mockClear()
                const provision = timed.provisionTable.bind(timed)
                vi.spyOn(timed, 'provisionTable').mockImplementationOnce(async (request) => {
                    expect(updates).not.toHaveBeenCalled()
                    expect(userService.getUser).not.toHaveBeenCalled()
                    const saved = await tournaments.read(id)
                    expect(saved?.status).toBe('locked')
                    expect(saved?.stages[0].status).toBe('scheduled')
                    const schedule = await tournaments.readSchedule(id, 'main')
                    expect(saved?.stages[0].scheduleId).toBe(schedule.id)
                    expect(saved?.stages[0].dispatch?.reserved).toEqual(
                        schedule.tables.slice(0, initialTables).map((table) => table.id)
                    )
                    expect(saved?.startId).toBeUndefined()
                    return provision(request)
                })
                await timed.runTask(task)
                expect(transactions).toHaveBeenCalledTimes(1 + initialTables)
                expect(updates).not.toHaveBeenCalled()
                expect((await tournaments.read(id))?.nextTaskAt).toBeUndefined()
                expect(await tournaments.readGameLinks(id)).toHaveLength(initialTables)
                expect(
                    (await tournaments.list(admin, { scope: 'open' })).tournaments.map(
                        (event) => event.id
                    )
                ).not.toContain(id)
            }
        )

        it('keeps registration open if saving the initial schedule fails', async () => {
            const { id, timed, task } = await readyTournament()
            const create = Transaction.prototype.create
            const failure = vi.spyOn(Transaction.prototype, 'create').mockImplementation(function (
                this: Transaction,
                ref,
                data
            ) {
                if (ref.path === `tournaments/${id}/schedules/main`)
                    throw new Error('Schedule write failed')
                return create.call(this, ref, data)
            })
            await expect(timed.runTask(task)).rejects.toThrow('Schedule write failed')
            const current = await tournaments.read(id)
            expect(current?.status).toBe('open')
            expect(current?.stages).toEqual([])
            expect(current?.startId).toBe(task.startId)
            expect((await db.doc(`tournaments/${id}/schedules/main`).get()).exists).toBe(false)
            expect(await tournaments.readGameLinks(id)).toEqual([])
            failure.mockRestore()
            await timed.runTask(task)
            expect(await tournaments.readGameLinks(id)).toHaveLength(7)
        })

        async function finish(gameId: string, result = GameResult.Win) {
            const game = await store.findGameById(gameId, true)
            assertExists(game?.state)
            const state = {
                ...game.state,
                result,
                winningPlayerIds: result === GameResult.Win ? [game.players[0].id] : []
            }
            return store.addActionsToGame({
                game,
                state,
                actions: [
                    { id: 'finish', gameId, source: ActionSource.System, type: 'finish', index: 0 }
                ],
                validator: async () => UpdateValidationResult.Proceed
            })
        }

        it('starts automatically after a fresh minute, invalidates withdrawn starts and rejects leaving at the deadline', async () => {
            const { tournament } = await fixture()
            let now = Date.now()
            const timed = new TournamentService(
                tournaments,
                userService,
                { synthetic: definition },
                notifications,
                games,
                { createPushTask: enqueue },
                () => now
            )
            const id = `${tournament.id}-countdown`
            await timed.create(id, tournament, admin)
            await timed.publish(id, admin)
            for (const user of users.slice(0, 7)) await timed.join(id, user)
            const first = await tournaments.read(id)
            assertExists(first?.startId)
            expect(first.startsAt).toBe(now + 60_000)
            expect(first.status).toBe('open')
            expect(enqueue).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    inSeconds: 60,
                    payload: { tournamentId: id, startId: first.startId }
                })
            )
            await timed.join(id, users[0])
            expect((await tournaments.read(id))?.startsAt).toBe(first.startsAt)
            now += 20_000
            await timed.leave(id, users[0])
            expect((await tournaments.read(id))?.startId).toBeUndefined()
            await timed.runTask({ tournamentId: id, startId: first.startId })
            expect((await tournaments.read(id))?.status).toBe('open')
            await timed.join(id, users[0])
            const second = await tournaments.read(id)
            assertExists(second?.startId)
            expect(second.startId).not.toBe(first.startId)
            now += 40_000
            await timed.runTask({ tournamentId: id, startId: first.startId })
            await timed.runTask({ tournamentId: id, startId: second.startId })
            expect((await tournaments.read(id))?.status).toBe('open')
            now += 20_000
            const results = await Promise.allSettled([
                timed.runTask({ tournamentId: id, startId: second.startId }),
                timed.leave(id, users[0])
            ])
            expect(results[1].status).toBe('rejected')
            await timed.runTask({ tournamentId: id })
            expect((await tournaments.read(id))?.status).toBe('inProgress')
            expect((await tournaments.readGameLinks(id)).length).toBe(7)
        })

        it('reports initial enqueue failure and retries the join without extending its countdown', async () => {
            const { tournament } = await fixture()
            let now = Date.now()
            const makeService = () =>
                new TournamentService(
                    tournaments,
                    userService,
                    { synthetic: definition },
                    notifications,
                    games,
                    { createPushTask: enqueue },
                    () => now
                )
            const original = makeService()
            const id = `${tournament.id}-lost-start`
            await original.create(id, tournament, admin)
            await original.publish(id, admin)
            for (const user of users.slice(0, 6)) await original.join(id, user)
            enqueue.mockRejectedValueOnce(new Error('Initial enqueue lost'))
            await expect(original.join(id, users[6])).rejects.toThrow('Initial enqueue lost')
            const pending = await tournaments.read(id)
            assertExists(pending?.startId)
            now += 20_000
            const restarted = makeService()
            enqueue.mockClear()
            await restarted.join(id, users[6])
            expect((await tournaments.read(id))?.startsAt).toBe(pending.startsAt)
            expect(enqueue).toHaveBeenCalledWith(
                expect.objectContaining({
                    payload: { tournamentId: id, startId: pending.startId },
                    inSeconds: 40
                })
            )
            now += 40_000
            await restarted.runTask({ tournamentId: id, startId: pending.startId })
            expect((await tournaments.readGameLinks(id)).length).toBe(7)
        })

        it('dispatches all games at the configured concurrency and tolerates duplicate deliveries', async () => {
            const { tournament, schedule } = await fixture()
            await Promise.all([
                service.runTask({ tournamentId: tournament.id }),
                service.runTask({ tournamentId: tournament.id })
            ])
            const current = await tournaments.read(tournament.id)
            expect(current?.stages[0].dispatch?.active).toHaveLength(schedule.tables.length)
            expect(current?.stages[0].dispatch?.reserved).toEqual([])
            expect(current?.nextTaskAt).toBeUndefined()
            const links = await tournaments.readGameLinks(tournament.id)
            expect(links).toHaveLength(schedule.tables.length)
            await service.runTask({ tournamentId: tournament.id })
            expect(await tournaments.readGameLinks(tournament.id)).toEqual(links)
        })

        it.each([
            [3, 7, 2],
            [4, 8, 1],
            [4, 8, 2]
        ])(
            'releases capacity under uneven completion with %i seats, %i entrants, limit %i',
            async (tableSize, capacity, concurrency) => {
                const { tournament, schedule } = await fixture(tableSize, capacity, concurrency)
                const seen = new Set<string>()
                for (let index = 0; index < schedule.tables.length; index++) {
                    await service.runTask({ tournamentId: tournament.id })
                    const current = await tournaments.read(tournament.id)
                    const dispatch = current?.stages[0].dispatch
                    assertExists(dispatch)
                    const counts = new Map<string, number>()
                    for (const table of schedule.tables.filter((table) =>
                        [...dispatch.active, ...dispatch.reserved].includes(table.id)
                    )) {
                        for (const entrant of table.entrantIds)
                            counts.set(entrant, (counts.get(entrant) ?? 0) + 1)
                    }
                    expect(Math.max(...counts.values())).toBeLessThanOrEqual(concurrency)
                    const tableId = dispatch.active.at(-1)
                    assertExists(tableId)
                    expect(seen.has(tableId)).toBe(false)
                    seen.add(tableId)
                    await finish(
                        tournamentGameId({ tournamentId: tournament.id, stageId: 'main', tableId })
                    )
                    const completed = await tournaments.read(tournament.id)
                    expect(completed?.stages[0].dispatch?.active).not.toContain(tableId)
                    expect(completed?.stages[0].dispatch?.finished).toContain(tableId)
                    expect(completed?.nextTaskAt).toBeDefined()
                }
                await service.runTask({ tournamentId: tournament.id })
                expect((await tournaments.read(tournament.id))?.nextTaskAt).toBeUndefined()
                expect(seen.size).toBe(schedule.tables.length)
            }
        )

        it('retries existing reservations and checks pause before creating a game', async () => {
            const { tournament, table, request, gameId } = await fixture()
            await tournaments.update(tournament.id, undefined, false, (current) => {
                current.stages[0].dispatch = {
                    reserved: [table.id],
                    active: [],
                    finished: []
                }
            })
            await service.control(tournament.id, 'pause', admin)
            await expect(service.provisionTable(request)).rejects.toThrow('reservation')
            await service.runTask({ tournamentId: tournament.id })
            expect((await db.doc(`games/${gameId}`).get()).exists).toBe(false)
            await service.control(tournament.id, 'resume', admin)
            await service.runTask({ tournamentId: tournament.id })
            expect((await tournaments.readGameLinks(tournament.id)).length).toBe(7)
            expect((await tournaments.read(tournament.id))?.stages[0].dispatch?.reserved).toEqual(
                []
            )
        })

        it('allows a retry to finish while an earlier execution is stalled before game creation', async () => {
            const { tournament, schedule } = await fixture()
            const provision = service.provisionTable.bind(service)
            const blocked = Promise.withResolvers<void>()
            const resume = Promise.withResolvers<void>()
            vi.spyOn(service, 'provisionTable').mockImplementationOnce(async (...args) => {
                blocked.resolve()
                await resume.promise
                return provision(...args)
            })
            const original = service.runTask({ tournamentId: tournament.id })
            await blocked.promise
            try {
                await service.runTask({ tournamentId: tournament.id })
                expect(await tournaments.readGameLinks(tournament.id)).toHaveLength(
                    schedule.tables.length
                )
            } finally {
                resume.resolve()
                await original
            }
            const current = await tournaments.read(tournament.id)
            expect(current?.stages[0].dispatch?.active).toHaveLength(schedule.tables.length)
            expect(current?.stages[0].dispatch?.reserved).toEqual([])
            expect(current?.nextTaskAt).toBeUndefined()
        })

        it('recovers after the game commit succeeds but the task loses its acknowledgement', async () => {
            const { tournament } = await fixture()
            const create = store.createGame.bind(store)
            vi.spyOn(store, 'createGame').mockImplementationOnce(async (...args) => {
                await create(...args)
                throw new Error('Lost acknowledgement')
            })
            enqueue.mockClear()
            await expect(service.runTask({ tournamentId: tournament.id })).rejects.toThrow(
                'Lost acknowledgement'
            )
            expect(enqueue).not.toHaveBeenCalled()
            const interrupted = await tournaments.read(tournament.id)
            expect(interrupted?.stages[0].dispatch?.active).toHaveLength(1)
            expect(interrupted?.stages[0].dispatch?.error).toBe('Lost acknowledgement')
            expect(interrupted?.nextTaskAt).toBeDefined()
            await service.runTask({ tournamentId: tournament.id })
            expect((await tournaments.readGameLinks(tournament.id)).length).toBe(7)
            expect(
                (await tournaments.read(tournament.id))?.stages[0].dispatch?.error
            ).toBeUndefined()
        })

        it('retries the original countdown task after registration locked and a game was committed', async () => {
            const { tournament } = await fixture()
            let now = Date.now()
            const timed = new TournamentService(
                tournaments,
                userService,
                { synthetic: definition },
                notifications,
                games,
                { createPushTask: enqueue },
                () => now
            )
            const id = `${tournament.id}-countdown-retry`
            await timed.create(id, tournament, admin)
            await timed.publish(id, admin)
            for (const user of users.slice(0, 7)) await timed.join(id, user)
            const pending = await tournaments.read(id)
            assertExists(pending?.startId)
            const task = { tournamentId: id, startId: pending.startId }
            now += 60_000
            const create = store.createGame.bind(store)
            vi.spyOn(store, 'createGame').mockImplementationOnce(async (...args) => {
                await create(...args)
                throw new Error('Lost countdown acknowledgement')
            })
            enqueue.mockClear()
            notify.mockClear()
            await expect(timed.runTask(task)).rejects.toThrow('Lost countdown acknowledgement')
            expect(enqueue).not.toHaveBeenCalled()
            expect(await tournaments.readGameLinks(id)).toHaveLength(1)
            expect(
                notify.mock.calls.filter(
                    ([message]) => message.notification.type === NotificationCategory.Tournament
                )
            ).toHaveLength(1)
            notify.mockClear()
            await timed.runTask(task)
            expect(await tournaments.readGameLinks(id)).toHaveLength(7)
            expect((await tournaments.read(id))?.nextTaskAt).toBeUndefined()
            expect(
                notify.mock.calls.filter(
                    ([message]) => message.notification.type === NotificationCategory.Tournament
                )
            ).toHaveLength(1)
        })

        it('sends one tournament update for a successful task', async () => {
            const { tournament } = await fixture()
            notify.mockClear()
            await service.runTask({ tournamentId: tournament.id })
            const updates = notify.mock.calls.filter(
                ([message]) => message.notification.type === NotificationCategory.Tournament
            )
            expect(updates).toHaveLength(1)
            expect(updates[0][0].notification.data).toEqual({
                tournamentId: tournament.id,
                revision: (await tournaments.read(tournament.id))?.revision
            })
        })

        it.each([false, true])(
            'records an existing game in dispatch without replaying it (finished: %s)',
            async (finished) => {
                const { tournament, request, gameId, table } = await fixture()
                await service.provisionTable(request)
                if (finished) await finish(gameId)
                const before = await store.findGameById(gameId, true)
                await tournaments.update(tournament.id, undefined, false, (current) => {
                    current.stages[0].dispatch = { reserved: [table.id], active: [], finished: [] }
                })
                await service.provisionTable(request)
                const dispatch = (await tournaments.read(tournament.id))?.stages[0].dispatch
                expect(dispatch?.reserved).toEqual([])
                expect(dispatch?.active).toEqual(finished ? [] : [table.id])
                expect(dispatch?.finished).toEqual(finished ? [table.id] : [])
                expect((await store.findGameById(gameId, true))?.state).toEqual(before?.state)
            }
        )

        it('reports enqueue failure and lets an administrator retry', async () => {
            const { tournament } = await fixture()
            enqueue.mockRejectedValueOnce(new Error('Queue unavailable'))
            await expect(service.control(tournament.id, 'resume', admin)).rejects.toThrow(
                'Queue unavailable'
            )
            const pending = await tournaments.read(tournament.id)
            expect(pending?.nextTaskAt).toBeDefined()
            enqueue.mockClear()
            const restarted = new TournamentService(
                tournaments,
                userService,
                { synthetic: definition },
                notifications,
                games,
                { createPushTask: enqueue }
            )
            await restarted.control(tournament.id, 'retry', admin)
            expect(enqueue).toHaveBeenCalledWith(
                expect.objectContaining({
                    payload: { tournamentId: tournament.id },
                    path: '/tournaments/dispatch'
                })
            )
            await restarted.runTask({ tournamentId: tournament.id })
            expect((await tournaments.readGameLinks(tournament.id)).length).toBe(7)
        })

        it('starts all fourteen eligible games in one task without enqueueing a continuation', async () => {
            const { tournament, schedule } = await fixture(3, 7, 6, 6)
            expect(tournament.stages[0].dispatch?.reserved).toHaveLength(14)
            enqueue.mockClear()
            notify.mockClear()
            await service.runTask({ tournamentId: tournament.id })
            expect(await tournaments.readGameLinks(tournament.id)).toHaveLength(14)
            const current = await tournaments.read(tournament.id)
            expect(current?.stages[0].dispatch?.active).toEqual(
                schedule.tables.map((table) => table.id)
            )
            expect(current?.stages[0].dispatch?.reserved).toEqual([])
            expect(current?.nextTaskAt).toBeUndefined()
            expect(enqueue).not.toHaveBeenCalled()
            expect(
                notify.mock.calls.filter(
                    ([message]) => message.notification.type === NotificationCategory.Tournament
                )
            ).toHaveLength(1)
        })

        it('rolls back a final result and capacity release together if State persistence fails', async () => {
            const { tournament } = await fixture()
            await service.runTask({ tournamentId: tournament.id })
            const link = (await tournaments.readGameLinks(tournament.id))[0]
            const set = Transaction.prototype.set
            const fail = vi.spyOn(Transaction.prototype, 'set').mockImplementation(function (
                this: Transaction,
                ref,
                data
            ) {
                if (ref.path === `games/${link.gameId}/states/${link.gameId}`)
                    throw new Error('Final state write failed')
                return set.call(this, ref, data)
            })
            await expect(finish(link.gameId)).rejects.toThrow()
            fail.mockRestore()
            expect((await tournaments.read(tournament.id))?.stages[0].dispatch?.active).toContain(
                link.tableId
            )
            expect((await store.findGameById(link.gameId, true))?.result).toBeUndefined()
            await finish(link.gameId)
            expect((await tournaments.read(tournament.id))?.stages[0].dispatch?.finished).toContain(
                link.tableId
            )
        })

        it('honors cancellation after the initial tables have been selected', async () => {
            const { tournament } = await fixture()
            const provision = service.provisionTable.bind(service)
            vi.spyOn(service, 'provisionTable').mockImplementationOnce(async (request) => {
                await service.cancel(tournament.id, admin)
                return provision(request)
            })
            await expect(service.runTask({ tournamentId: tournament.id })).rejects.toThrow(
                'no saved schedule'
            )
            const cancelled = await tournaments.read(tournament.id)
            expect(cancelled?.status).toBe('cancelled')
            expect(cancelled?.nextTaskAt).toBeUndefined()
            expect(await tournaments.readGameLinks(tournament.id)).toEqual([])
        })

        it('keeps unresolved abandoned games occupying their slots', async () => {
            const { tournament } = await fixture()
            await service.runTask({ tournamentId: tournament.id })
            const links = await tournaments.readGameLinks(tournament.id)
            await finish(links[0].gameId, GameResult.Abandoned)
            const current = await tournaments.read(tournament.id)
            expect(current?.stages[0].dispatch?.active).toContain(links[0].tableId)
            expect(current?.stages[0].dispatch?.finished).toEqual([])
        })

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
        it('serializes duplicate task executions and returns the same initialized state', async () => {
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
            const { request, gameId } = await fixture(3, 7, 1)
            await tournaments.update(request.tournamentId, undefined, false, (current) => {
                assertExists(current.stages[0].dispatch)
                current.stages[0].dispatch.error = 'Previous attempt failed'
            })
            const before = await tournaments.read(request.tournamentId)
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
            expect(await tournaments.read(request.tournamentId)).toEqual(before)
            failing.mockRestore()
            expect((await service.provisionTable(request)).status).toBe(GameStatus.Started)
            const started = await tournaments.read(request.tournamentId)
            expect(started?.nextTaskAt).toBeUndefined()
            expect(started?.stages[0].dispatch?.error).toBeUndefined()
            expect(started?.stages[0].dispatch?.reserved).toEqual([])
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
