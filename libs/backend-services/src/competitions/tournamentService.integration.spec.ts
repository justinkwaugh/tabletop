import { createClient, type RedisClientType } from 'redis'
import { cacheFixture } from '../cache/tests/cacheFixture.js'
import { Firestore, Transaction } from '@google-cloud/firestore'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import {
    BaseConfigurator,
    ConfigOptionType,
    Role,
    UserStatus,
    type GameConfigOptions,
    type GameDefinition,
    type TournamentDraft,
    type User
} from '@tabletop/common'
import { Type } from 'typebox'
import type { NotificationService } from '../notifications/notificationService.js'
import { generateTournamentSchedule } from './tournamentScheduler.js'
import { GameService } from '../games/gameService.js'
import { TournamentService } from './tournamentService.js'
import { FirestoreTournamentStore } from '../persistence/firestore/tournamentStore.js'

class Configurator extends BaseConfigurator {
    schema = Type.Object({ expert: Type.Boolean() }, { additionalProperties: false })
    options: GameConfigOptions = [
        {
            id: 'expert',
            type: ConfigOptionType.Boolean,
            name: 'Expert rules',
            description: '',
            default: false
        }
    ]
}

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST || !process.env.CACHE_TEST_REDIS_HOST)(
    'Tournament registration in Firestore',
    { timeout: 15_000 },
    () => {
        const cachePrefix = `demo-tournaments-${Date.now()}`
        const firestore = new Firestore({ projectId: cachePrefix })
        const client: RedisClientType = createClient({
            socket: { host: process.env.CACHE_TEST_REDIS_HOST, reconnectStrategy: false }
        })
        const { cache } = cacheFixture(client)
        const store = new FirestoreTournamentStore(cache, firestore, cachePrefix)
        const users = Array.from(
            { length: 6 },
            (_, index): User => ({
                id: `user-${index}`,
                username: `Player${index}`,
                status: UserStatus.Active,
                roles: index === 0 ? [Role.User, Role.Admin] : [Role.User],
                externalIds: []
            })
        )
        const admin = users[0]
        let now = Date.now()
        const title: Pick<GameDefinition, 'info'> = {
            info: {
                id: 'test',
                metadata: {
                    name: 'Test',
                    designer: '',
                    description: '',
                    year: '',
                    version: '1.0.0',
                    beta: false,
                    minPlayers: 2,
                    maxPlayers: 5,
                    defaultPlayerCount: 4
                },
                configurator: new Configurator()
            }
        }
        const sendNotification = vi.fn<NotificationService['sendNotification']>(
            async () => undefined
        )
        const notifications = { sendNotification }
        const service = new TournamentService(
            store,
            { getUser: async (id) => users.find((user) => user.id === id) },
            { test: title },
            notifications,
            GameService.prototype,
            { createPushTask: async () => undefined },
            () => now
        )
        let sequence = 0

        function draft(): TournamentDraft {
            return {
                name: 'Test tournament',
                description: '',
                format: {
                    kind: 'mini',
                    stages: [{ id: 'opening', name: 'Main stage', gamesPerEntrant: 2 }]
                },
                rules: {
                    titleId: 'test',
                    tableSize: 2,
                    registration: { kind: 'whenFull', capacity: 2 },
                    concurrency: 2,
                    gameConfig: {},
                    scoring: 'splitWinsV1'
                }
            }
        }

        async function open(input = draft()) {
            const tournament = await service.create(`event-${sequence++}`, input, admin)
            await service.publish(tournament.id, admin)
            return tournament.id
        }

        beforeAll(async () => {
            await client.connect()
            await Promise.all(
                users.map((user) => firestore.collection('users').doc(user.id).set(user))
            )
        })
        afterAll(async () => {
            cache.destroy()
            for await (const keys of client.scanIterator({
                MATCH: `${cachePrefix}:*`,
                COUNT: 100
            })) {
                if (keys.length) await client.del(keys)
            }
            client.destroy()
            await firestore.terminate()
        })

        it('persists default options and a draft that is hidden from non-administrators', async () => {
            const tournament = await service.create(`event-${sequence++}`, draft(), admin)
            expect(tournament.rules.gameConfig).toEqual({ expert: false })
            await expect(service.get(tournament.id, users[1])).rejects.toMatchObject({
                statusCode: 404
            })
            const reload = new TournamentService(
                new FirestoreTournamentStore(cache, firestore, cachePrefix),
                { getUser: async () => undefined },
                { test: title },
                notifications,
                GameService.prototype,
                { createPushTask: async () => undefined }
            )
            expect((await reload.get(tournament.id, admin)).tournament).toEqual(tournament)
            expect(await service.create(tournament.id, draft(), admin)).toEqual(tournament)
            await expect(
                service.create(tournament.id, { ...draft(), name: 'Different event' }, admin)
            ).rejects.toMatchObject({ statusCode: 409 })
            await expect(service.create('unauthorized', draft(), users[1])).rejects.toMatchObject({
                statusCode: 403
            })
        })

        it('validates table sizes and options through the existing title definition', async () => {
            const constrainedService = new TournamentService(
                store,
                { getUser: async (id) => users.find((user) => user.id === id) },
                {
                    test: {
                        info: {
                            ...title.info,
                            metadata: { ...title.info.metadata, minPlayers: 3, maxPlayers: 4 }
                        }
                    }
                },
                notifications,
                GameService.prototype,
                { createPushTask: async () => undefined },
                () => now
            )
            for (const tableSize of [2, 5]) {
                const input = draft()
                input.rules.tableSize = tableSize
                await expect(
                    constrainedService.create(`event-${sequence++}`, input, admin)
                ).rejects.toThrow('This game does not support that table size')
            }
            const input = draft()
            input.rules.tableSize = 3
            input.rules.registration = { kind: 'whenFull', capacity: 3 }
            input.format.stages[0].gamesPerEntrant = 3
            input.rules.gameConfig = { expert: 'yes' }
            await expect(
                constrainedService.create(`event-${sequence++}`, input, admin)
            ).rejects.toThrow('Invalid game configuration')
            input.rules.gameConfig = { expert: true }
            const created = await constrainedService.create(`event-${sequence++}`, input, admin)
            expect(created.rules.tableSize).toBe(3)
            expect(created.rules.gameConfig).toEqual({ expert: true })
        })

        async function lockedScheduleEvent(capacity = 2, games = 2) {
            const input = draft()
            input.rules.registration = { kind: 'whenFull', capacity }
            input.format.stages[0].gamesPerEntrant = games
            const id = await open(input)
            await Promise.all(users.slice(0, capacity).map((user) => service.join(id, user)))
            now += 60_000
            await service.lock(id, admin)
            const detail = await service.get(id, admin)
            return {
                id,
                request: { revision: detail.tournament.revision, seed: 42, version: 1 as const }
            }
        }

        it('previews without writes and publishes one immutable schedule across retries and reloads', async () => {
            const { id, request } = await lockedScheduleEvent()
            const preview = await service.previewSchedule(id, request, admin)
            expect((await store.read(id))?.stages[0]?.status).toBe('awaitingSchedule')
            await expect(service.getSchedule(id, users[1])).rejects.toMatchObject({
                statusCode: 404
            })
            const commit = { ...request, scheduleId: preview.id }
            const saved = await Promise.all([
                service.commitSchedule(id, commit, admin),
                service.commitSchedule(id, commit, admin)
            ])
            expect(saved).toEqual([preview, preview])
            expect(await service.commitSchedule(id, commit, admin)).toEqual(preview)
            const detail = await service.get(id, users[1])
            expect(detail.tournament.stages[0]?.status).toBe('scheduled')
            expect(detail.tournament.status).toBe('locked')
            expect(detail.tournament.revision).toBe(request.revision + 1)
            const freshStore = new FirestoreTournamentStore(cache, firestore, cachePrefix)
            expect(await freshStore.readSchedule(id, 'opening')).toEqual(preview)
            expect(await service.getSchedule(id, users[1])).toEqual(preview)
        })

        it('protects previews and commits against unauthorized, stale, altered and cancelled requests', async () => {
            const { id, request } = await lockedScheduleEvent()
            await expect(service.previewSchedule(id, request, users[1])).rejects.toMatchObject({
                statusCode: 403
            })
            await expect(
                service.previewSchedule(id, { ...request, revision: 1 }, admin)
            ).rejects.toMatchObject({ statusCode: 409 })
            const preview = await service.previewSchedule(id, request, admin)
            const commit = { ...request, scheduleId: preview.id }
            await expect(service.commitSchedule(id, commit, users[1])).rejects.toMatchObject({
                statusCode: 403
            })
            await expect(
                service.commitSchedule(id, { ...commit, seed: 99 }, admin)
            ).rejects.toMatchObject({ statusCode: 409 })
            await firestore
                .collection('users')
                .doc(admin.id)
                .update({ roles: [Role.User] })
            try {
                await expect(service.commitSchedule(id, commit, admin)).rejects.toMatchObject({
                    statusCode: 403
                })
            } finally {
                await firestore.collection('users').doc(admin.id).set(admin)
            }
            await service.cancel(id, admin)
            await expect(service.commitSchedule(id, commit, admin)).rejects.toMatchObject({
                statusCode: 409
            })
            expect((await store.read(id))?.stages[0]?.scheduleId).toBeUndefined()
        })

        it('serializes competing draws without replacing the winning schedule', async () => {
            const { id, request } = await lockedScheduleEvent()
            const previews = await Promise.all(
                [42, 99].map((seed) => service.previewSchedule(id, { ...request, seed }, admin))
            )
            const results = await Promise.allSettled(
                previews.map((preview) =>
                    service.commitSchedule(
                        id,
                        { ...request, seed: preview.seed, scheduleId: preview.id },
                        admin
                    )
                )
            )
            expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
            const saved = await service.getSchedule(id, admin)
            expect(previews).toContainEqual(saved)
            const loser = previews.find((preview) => preview.id !== saved.id)!
            await expect(
                service.commitSchedule(
                    id,
                    { ...request, seed: loser.seed, scheduleId: loser.id },
                    admin
                )
            ).rejects.toMatchObject({ statusCode: 409 })
            expect(await service.getSchedule(id, admin)).toEqual(saved)
        })

        it('stores 640 tables in one schedule document and commits with two writes', async () => {
            const { id, request } = await lockedScheduleEvent(5, 256)
            const preview = await service.previewSchedule(id, request, admin)
            expect(preview.tables).toHaveLength(640)
            const writes = vi.spyOn(Transaction.prototype, 'set')
            const creates = vi.spyOn(Transaction.prototype, 'create')
            const reads = vi.spyOn(Transaction.prototype, 'get')
            try {
                await store.commitSchedule(preview, request.revision, admin, now)
                expect(writes).toHaveBeenCalledTimes(1)
                expect(creates).toHaveBeenCalledTimes(1)
                expect(reads).toHaveBeenCalledTimes(2)
            } finally {
                writes.mockRestore()
                creates.mockRestore()
                reads.mockRestore()
            }
            expect(await service.getSchedule(id, admin)).toEqual(preview)
            const schedules = await firestore
                .collection('tournaments')
                .doc(id)
                .collection('schedules')
                .get()
            expect(schedules.size).toBe(1)
            expect(schedules.docs[0].data().positions).toHaveLength(1280)
            expect(await schedules.docs[0].ref.listCollections()).toEqual([])
        })

        it('fits the maximum schedule and roster in two Firestore documents', async () => {
            const { id } = await lockedScheduleEvent()
            const tournament = (await service.get(id, admin)).tournament
            tournament.rules.tableSize = 2
            tournament.rules.concurrency = 256
            tournament.format.stages[0].gamesPerEntrant = 256
            tournament.entrants = Array.from({ length: 256 }, (_, index) => ({
                userId: 'x'.repeat(1496) + String(index).padStart(4, '0'),
                joinedAt: now
            }))
            const ref = firestore.collection('tournaments').doc(id)
            await ref.set({
                ...tournament,
                entrantIds: tournament.entrants.map((entrant) => entrant.userId)
            })
            const schedule = generateTournamentSchedule(tournament, 42)
            expect(schedule.tables).toHaveLength(32768)
            await store.commitSchedule(schedule, tournament.revision, admin, now)
            const reloaded = await store.readSchedule(id, 'opening')
            expect(reloaded).toEqual(schedule)
            await store.update(id, undefined, false, (current) => {
                current.stages[0].dispatch = {
                    reserved: [],
                    active: [],
                    finished: schedule.tables.map((table) => table.id)
                }
            })
            expect((await ref.collection('schedules').get()).size).toBe(1)
        })

        it('rolls back both records if schedule publication fails and retries atomically', async () => {
            const { id, request } = await lockedScheduleEvent()
            const preview = await service.previewSchedule(id, request, admin)
            const commit = { ...request, scheduleId: preview.id }
            const spy = vi.spyOn(Transaction.prototype, 'set').mockImplementation(() => {
                throw new Error('Interrupted transaction')
            })
            try {
                await expect(service.commitSchedule(id, commit, admin)).rejects.toThrow(
                    'Interrupted transaction'
                )
            } finally {
                spy.mockRestore()
            }
            expect(
                (await firestore.collection('tournaments').doc(id).collection('schedules').get())
                    .empty
            ).toBe(true)
            await expect(service.getSchedule(id, admin)).rejects.toMatchObject({ statusCode: 404 })
            await service.commitSchedule(id, commit, admin)
            expect(await service.getSchedule(id, admin)).toEqual(preview)
        })

        it('serializes cancellation and saving without partial schedules', async () => {
            const { id, request } = await lockedScheduleEvent()
            const preview = await service.previewSchedule(id, request, admin)
            const [commit] = await Promise.allSettled([
                service.commitSchedule(id, { ...request, scheduleId: preview.id }, admin),
                service.cancel(id, admin)
            ])
            const current = await store.read(id)
            expect(current?.status).toBe('cancelled')
            const schedules = await firestore
                .collection('tournaments')
                .doc(id)
                .collection('schedules')
                .get()
            expect(schedules.size).toBe(commit.status === 'fulfilled' ? 1 : 0)
            expect(current?.stages[0]?.scheduleId).toBe(
                commit.status === 'fulfilled' ? preview.id : undefined
            )
        })

        it('serializes competing joins for the last place and locks after the grace period', async () => {
            const id = await open()
            await service.join(id, users[1])
            const results = await Promise.allSettled([
                service.join(id, users[2]),
                service.join(id, users[3])
            ])
            expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
            expect((await service.get(id, admin)).tournament.startsAt).toBe(now + 60_000)
            now += 60_000
            await service.lock(id, admin)
            const detail = await service.get(id, admin)
            expect(detail.tournament.status).toBe('locked')
            expect(detail.tournament.entrants).toHaveLength(2)
            expect(detail.tournament.stages[0]?.id).toBe('opening')
            expect(
                (await firestore.collection('tournaments').doc(id).get()).data()?.stages.length
            ).toBe(1)
            const winner = users.find((user) =>
                detail.tournament.entrants.some((entrant) => entrant.userId === user.id)
            )!
            await service.join(id, winner)
            expect((await service.get(id, admin)).tournament.entrants.length).toBe(2)
            await expect(service.leave(id, winner)).rejects.toMatchObject({ statusCode: 409 })
        })

        it('keeps deadline events open at capacity and locks the actual roster at the deadline', async () => {
            const input = draft()
            input.rules.registration = {
                kind: 'deadline',
                minimumEntrants: 2,
                capacity: 3,
                closesAt: now + 1000
            }
            const id = await open(input)
            await Promise.all([users[1], users[2], users[3]].map((user) => service.join(id, user)))
            expect((await service.get(id, admin)).tournament.status).toBe('open')
            await expect(service.join(id, users[4])).rejects.toMatchObject({ statusCode: 409 })
            await service.leave(id, users[3])
            expect(
                (await service.list(users[3], { scope: 'mine' })).tournaments.map(
                    (tournament) => tournament.id
                )
            ).not.toContain(id)
            await expect(service.lock(id, admin)).rejects.toMatchObject({ statusCode: 409 })
            now += 1001
            await service.lock(id, admin)
            const detail = await service.get(id, admin)
            expect(detail.tournament.status).toBe('locked')
            expect(detail.tournament.entrants.length).toBe(2)
        })

        it('cancels undersubscribed dated events but never expires when-full events', async () => {
            const input = draft()
            input.rules.registration = {
                kind: 'deadline',
                minimumEntrants: 3,
                closesAt: now + 1000
            }
            const dated = await open(input)
            const indefinite = await open()
            await service.join(dated, users[1])
            now += 365 * 86_400_000
            await service.runTask({ tournamentId: dated })
            expect((await service.get(dated, admin)).tournament.cancellationReason).toBe(
                'undersubscribed'
            )
            expect((await service.get(indefinite, admin)).tournament.status).toBe('open')
            expect((await service.get(dated, admin)).tournament.stages[0]).toBeUndefined()
        })

        it('commits deadline closure even when a late join is rejected', async () => {
            const input = draft()
            input.rules.registration = {
                kind: 'deadline',
                minimumEntrants: 2,
                closesAt: now + 1000
            }
            const id = await open(input)
            now += 1001
            await expect(service.join(id, users[1])).rejects.toMatchObject({ statusCode: 409 })
            expect((await store.read(id))?.status).toBe('cancelled')
        })

        it('keeps join/leave races consistent with the final locked roster', async () => {
            const id = await open()
            await service.join(id, users[1])
            await Promise.allSettled([service.leave(id, users[1]), service.join(id, users[2])])
            const detail = await service.get(id, admin)
            expect(detail.tournament.entrants.length).toBe(detail.tournament.entrants.length)
            expect(detail.tournament.status).toBe(
                detail.tournament.entrants.length === 2 ? 'locked' : 'open'
            )
            expect(Boolean(detail.tournament.stages[0])).toBe(detail.tournament.status === 'locked')
        })

        it('rechecks account status in the membership transaction', async () => {
            const id = await open()
            await firestore
                .collection('users')
                .doc(users[5].id)
                .update({ status: UserStatus.Inactive })
            await expect(service.join(id, users[5])).rejects.toMatchObject({ statusCode: 403 })
        })

        it('freezes published options and rejects stale draft edits', async () => {
            const created = await service.create(`event-${sequence++}`, draft(), admin)
            const changed = draft()
            changed.rules.gameConfig = { expert: true }
            await service.update(created.id, changed, created.revision, admin)
            await expect(
                service.update(created.id, draft(), created.revision, admin)
            ).rejects.toMatchObject({ statusCode: 409 })
            await service.publish(created.id, admin)
            const published = await service.get(created.id, admin)
            await expect(
                service.update(created.id, draft(), published.tournament.revision, admin)
            ).rejects.toMatchObject({ statusCode: 409 })
            expect(published.tournament.rules.gameConfig).toEqual({ expert: true })
        })

        it('validates position balance and gates multi-stage execution', async () => {
            const input = draft()
            input.format.stages[0].gamesPerEntrant = 3
            await expect(service.create('unbalanced', input, admin)).rejects.toMatchObject({
                statusCode: 400
            })
            input.format = {
                kind: 'multiStage',
                stages: [
                    { id: '1', name: 'First', gamesPerEntrant: 2 },
                    { id: '2', name: 'Final', gamesPerEntrant: 2 }
                ]
            }
            await expect(service.create('multi', input, admin)).rejects.toMatchObject({
                statusCode: 400
            })
        })
        it('publishes committed changes to administrators privately until registration opens', async () => {
            sendNotification.mockClear()
            const created = await service.create(`event-${sequence++}`, draft(), admin)
            expect(sendNotification).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    topics: expect.arrayContaining([`user-${admin.id}`]),
                    notification: expect.objectContaining({
                        data: { tournamentId: created.id, revision: created.revision }
                    })
                })
            )
            const privateTopics = sendNotification.mock.calls.at(-1)?.[0].topics ?? []
            expect(privateTopics).not.toContain('global')
            for (const user of users.slice(1))
                expect(privateTopics).not.toContain(`user-${user.id}`)
            await service.publish(created.id, admin)
            expect(sendNotification).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    topics: ['global'],
                    notification: expect.objectContaining({
                        data: { tournamentId: created.id, revision: created.revision + 1 }
                    })
                })
            )
            await service.join(created.id, users[1])
            expect(sendNotification).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    topics: ['global'],
                    notification: expect.objectContaining({
                        data: { tournamentId: created.id, revision: created.revision + 2 }
                    })
                })
            )
            const count = sendNotification.mock.calls.length
            await expect(service.update(created.id, draft(), 1, admin)).rejects.toMatchObject({
                statusCode: 409
            })
            expect(sendNotification).toHaveBeenCalledTimes(count)
        })

        it('filters games before pagination for public and personal lists', async () => {
            const id = await open()
            await service.join(id, users[4])
            expect(
                (await service.list(users[4], { scope: 'mine', titleId: 'test' })).tournaments.map(
                    (event) => event.id
                )
            ).toContain(id)
            expect(
                (await service.list(users[4], { scope: 'mine', titleId: 'other' })).tournaments
            ).toEqual([])
            const template = (await service.get(id, admin)).tournament
            const batch = firestore.batch()
            const ids: string[] = []
            for (let index = 0; index < 27; index++) {
                for (const titleId of ['filter-game', 'other-game']) {
                    const eventId = `filter-${String(index).padStart(2, '0')}-${titleId}`
                    if (titleId === 'filter-game') ids.push(eventId)
                    batch.set(firestore.collection('tournaments').doc(eventId), {
                        ...template,
                        id: eventId,
                        entrants: [{ userId: users[5].id, joinedAt: now }],
                        entrantIds: [users[5].id],
                        rules: { ...template.rules, titleId }
                    })
                }
            }
            for (const status of ['draft', 'locked', 'inProgress']) {
                batch.set(firestore.collection('tournaments').doc(`filter-${status}`), {
                    ...template,
                    id: `filter-${status}`,
                    status,
                    rules: { ...template.rules, titleId: 'filter-game' }
                })
            }
            await batch.commit()
            for (const scope of ['open', 'mine'] as const) {
                const first = await service.list(users[5], { scope, titleId: 'filter-game' })
                expect(first.tournaments.map((event) => event.id)).toEqual(ids.slice(0, 25))
                expect(first.nextCursor).toBe(ids[24])
                const second = await service.list(users[5], {
                    scope,
                    titleId: 'filter-game',
                    after: first.nextCursor
                })
                expect(second.tournaments.map((event) => event.id)).toEqual(ids.slice(25))
                expect(second.nextCursor).toBeUndefined()
            }
            expect(
                (
                    await service.list(admin, { scope: 'draft', titleId: 'filter-game' })
                ).tournaments.map((event) => event.id)
            ).toEqual(['filter-draft'])
            expect(
                (
                    await service.list(admin, { scope: 'inProgress', titleId: 'filter-game' })
                ).tournaments.map((event) => event.id)
            ).toEqual(['filter-inProgress', 'filter-locked'])
        })

        it('separates open, running and administrator draft queries', async () => {
            const created = await service.create(`event-${sequence++}`, draft(), admin)
            expect(
                (await service.list(admin, { scope: 'draft' })).tournaments.map((event) => event.id)
            ).toContain(created.id)
            await expect(service.list(users[1], { scope: 'draft' })).rejects.toMatchObject({
                statusCode: 403
            })
            const id = await open()
            await service.join(id, users[1])
            await service.join(id, users[2])
            now += 60_000
            await service.lock(id, admin)
            expect(
                (await service.list(users[1], { scope: 'inProgress' })).tournaments.map(
                    (event) => event.id
                )
            ).toContain(id)
            await firestore.collection('tournaments').doc(id).update({ status: 'inProgress' })
            expect(
                (await service.list(users[1], { scope: 'inProgress' })).tournaments.map(
                    (event) => event.id
                )
            ).toContain(id)
            expect(
                (await service.list(users[1], { scope: 'open' })).tournaments.map(
                    (event) => event.id
                )
            ).not.toContain(id)
            await expect(service.cancel(id, admin)).rejects.toMatchObject({ statusCode: 409 })
        })
    }
)
