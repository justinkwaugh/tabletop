import { Firestore, DocumentReference, Query } from '@google-cloud/firestore'
import { createClient, type RedisClientType } from 'redis'
import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { Role, UserStatus, type Tournament, type User } from '@tabletop/common'
import { cacheFixture } from '../../cache/tests/cacheFixture.js'
import { generateTournamentSchedule } from '../../competitions/tournamentScheduler.js'
import { FirestoreTournamentStore } from './tournamentStore.js'

const readDocument = DocumentReference.prototype.get
const readQuery = Query.prototype.get

describe.skipIf(!process.env.CACHE_TEST_REDIS_HOST || !process.env.FIRESTORE_EMULATOR_HOST)(
    'Tournament caches with Firestore and Redis',
    { timeout: 15_000 },
    () => {
        let db: Firestore
        let prefix: string
        let clients: RedisClientType[]
        let caches: ReturnType<typeof cacheFixture>[]
        let store: FirestoreTournamentStore
        let other: FirestoreTournamentStore
        let documentReads: MockInstance<DocumentReference['get']>
        let queryReads: MockInstance<Query['get']>
        const admin: User = {
            id: 'admin',
            status: UserStatus.Active,
            roles: [Role.Admin],
            externalIds: []
        }
        const newcomer: User = { ...admin, id: 'newcomer', roles: [Role.User] }

        function event(id = 'event'): Tournament {
            return {
                id,
                name: 'Mini',
                description: '',
                organizerId: admin.id,
                status: 'open',
                revision: 1,
                createdAt: 1,
                updatedAt: 1,
                publishedAt: 1,
                entrants: [{ userId: admin.id, joinedAt: 1 }],
                stages: [],
                format: {
                    kind: 'mini',
                    stages: [{ id: 'main', name: 'Main', gamesPerEntrant: 2 }]
                },
                rules: {
                    titleId: 'sol',
                    tableSize: 2,
                    concurrency: 1,
                    gameConfig: {},
                    scoring: 'splitWinsV1',
                    registration: { kind: 'whenFull', capacity: 4 }
                }
            }
        }
        beforeEach(async () => {
            prefix = `demo-tournament-cache-${randomUUID()}`
            db = new Firestore({ projectId: prefix })
            clients = Array.from({ length: 2 }, () =>
                createClient({
                    socket: { host: process.env.CACHE_TEST_REDIS_HOST, reconnectStrategy: false }
                })
            )
            await Promise.all(clients.map((client) => client.connect()))
            caches = clients.map((client) => cacheFixture(client))
            store = new FirestoreTournamentStore(caches[0].cache, db, prefix)
            other = new FirestoreTournamentStore(caches[1].cache, db, prefix)
            await db.doc(`users/${admin.id}`).set(admin)
            documentReads = vi.spyOn(DocumentReference.prototype, 'get')
            queryReads = vi.spyOn(Query.prototype, 'get')
        })
        afterEach(async () => {
            vi.restoreAllMocks()
            for (const live of caches) {
                await live.pool.close()
                await live.guardPool.close()
            }
            for await (const keys of clients[0].scanIterator({
                MATCH: `${prefix}:*`,
                COUNT: 100
            })) {
                if (keys.length) await clients[0].del(keys)
            }
            for (const client of clients) client.destroy()
            await db.terminate()
        })
        function clearReads() {
            documentReads.mockClear()
            queryReads.mockClear()
        }
        function expectNoReads() {
            expect(documentReads).not.toHaveBeenCalled()
            expect(queryReads).not.toHaveBeenCalled()
        }
        async function warm(read: () => Promise<unknown>) {
            await read()
            await vi.waitFor(async () => {
                clearReads()
                await read()
                expectNoReads()
            })
        }

        it('serves unchanged tournaments, schedules, lists and deadline checks without database reads across clients', async () => {
            const tournament = event()
            tournament.status = 'locked'
            tournament.entrants.push({ userId: newcomer.id, joinedAt: 1 })
            tournament.stages.push({
                id: 'main',
                status: 'awaitingSchedule',
                rosterRevision: 1,
                createdAt: 1
            })
            await store.create(tournament, admin)
            const schedule = generateTournamentSchedule(tournament, 1)
            await store.commitSchedule(schedule, 1, admin, 2)
            await warm(async () => {
                await store.read(tournament.id)
                await store.readSchedule(tournament.id, 'main')
                await store.list(admin, { scope: 'mine' })
                await store.list(admin, { scope: 'inProgress', titleId: 'sol' })
            })
            clearReads()
            const result = await other.read(tournament.id)
            expect(result?.stages[0].scheduleId).toBe(schedule.id)
            expect(await other.readSchedule(tournament.id, 'main')).toEqual(schedule)
            expect((await other.list(admin, { scope: 'mine' })).tournaments).toHaveLength(1)
            expect(
                (await other.list(admin, { scope: 'inProgress', titleId: 'sol' })).tournaments
            ).toHaveLength(1)
            expectNoReads()
        })

        it('invalidates a cached missing tournament when it is created', async () => {
            await warm(() => store.read('event'))
            clearReads()
            expect(await other.read('event')).toBeUndefined()
            expectNoReads()
            await other.create(event(), admin)
            expect((await store.read('event'))?.name).toBe('Mini')
            await warm(() => store.read('event'))
        })

        it('invalidates roster details and affected list variants, including cached empty Mine results', async () => {
            await store.create(event(), admin)
            await warm(async () => {
                await store.read('event')
                await store.list(admin, { scope: 'open' })
                await store.list(admin, { scope: 'open', titleId: 'sol' })
                await store.list(admin, { scope: 'open', after: 'a' })
                await store.list(newcomer, { scope: 'mine' })
                await store.list(newcomer, { scope: 'draft' })
            })
            await other.update('event', admin, true, (tournament) => {
                tournament.name = 'Updated'
                tournament.entrants.push({ userId: newcomer.id, joinedAt: 2 })
                tournament.revision++
            })
            expect((await store.read('event'))?.name).toBe('Updated')
            for (const query of [
                { scope: 'open' },
                { scope: 'open', titleId: 'sol' },
                { scope: 'open', after: 'a' },
                { scope: 'mine' }
            ] as const)
                expect((await store.list(newcomer, query)).tournaments[0].name).toBe('Updated')
            clearReads()
            expect((await store.list(admin, { scope: 'draft' })).tournaments).toEqual([])
            expectNoReads()
            await other.update('event', admin, true, (tournament) => {
                tournament.status = 'locked'
                tournament.revision++
            })
            expect((await store.list(admin, { scope: 'open' })).tournaments).toEqual([])
            expect((await store.list(admin, { scope: 'inProgress' })).tournaments).toHaveLength(1)
            await other.update('event', admin, true, (tournament) => {
                tournament.entrants = []
                tournament.revision++
            })
            expect((await store.list(newcomer, { scope: 'mine' })).tournaments).toEqual([])
        })

        it('does not cache an old tournament snapshot over a completed write', async () => {
            await store.create(event(), admin)
            const started = Promise.withResolvers<void>()
            const released = Promise.withResolvers<void>()
            let held = false
            documentReads.mockImplementation(async function (this: DocumentReference) {
                const snapshot = await readDocument.call(this)
                if (this.path === 'tournaments/event' && !held) {
                    held = true
                    started.resolve()
                    await released.promise
                }
                return snapshot
            })
            const reading = store.read('event')
            try {
                await started.promise
                await other.update('event', admin, true, (tournament) => {
                    tournament.name = 'New'
                    tournament.revision++
                })
            } finally {
                released.resolve()
            }
            expect((await reading)?.name).toBe('Mini')
            expect((await store.read('event'))?.name).toBe('New')
            await warm(() => store.read('event'))
            expect((await other.read('event'))?.name).toBe('New')
        })

        it('rejects an obsolete list fill after a membership change', async () => {
            await store.create(event(), admin)
            const started = Promise.withResolvers<void>()
            const released = Promise.withResolvers<void>()
            let held = false
            queryReads.mockImplementation(async function (this: Query) {
                const snapshot = await readQuery.call(this)
                if (!held) {
                    held = true
                    started.resolve()
                    await released.promise
                }
                return snapshot
            })
            const reading = store.list(newcomer, { scope: 'mine' })
            try {
                await started.promise
                await other.update('event', admin, true, (tournament) => {
                    tournament.entrants.push({ userId: newcomer.id, joinedAt: 2 })
                    tournament.revision++
                })
            } finally {
                released.resolve()
            }
            expect((await reading).tournaments).toEqual([])
            expect((await store.list(newcomer, { scope: 'mine' })).tournaments).toHaveLength(1)
            await warm(() => store.list(newcomer, { scope: 'mine' }))
        })
    }
)
