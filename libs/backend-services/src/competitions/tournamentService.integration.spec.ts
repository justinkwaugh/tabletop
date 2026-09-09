import { Firestore } from '@google-cloud/firestore'
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

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)(
    'Tournament registration in Firestore',
    () => {
        const firestore = new Firestore({ projectId: `demo-tournaments-${Date.now()}` })
        const store = new FirestoreTournamentStore(firestore)
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
            await Promise.all(
                users.map((user) => firestore.collection('users').doc(user.id).set(user))
            )
        })
        afterAll(async () => {
            await firestore.terminate()
        })

        it('persists default options and a draft that is hidden from non-administrators', async () => {
            const tournament = await service.create(`event-${sequence++}`, draft(), admin)
            expect(tournament.rules.gameConfig).toEqual({ expert: false })
            await expect(service.get(tournament.id, users[1])).rejects.toMatchObject({
                statusCode: 404
            })
            const reload = new TournamentService(
                new FirestoreTournamentStore(firestore),
                { getUser: async () => undefined },
                { test: title },
                notifications
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

        it('serializes competing joins for the last place and creates one locked stage', async () => {
            const id = await open()
            await service.join(id, users[1])
            const results = await Promise.allSettled([
                service.join(id, users[2]),
                service.join(id, users[3])
            ])
            expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
            const detail = await service.get(id, admin)
            expect(detail.tournament.status).toBe('locked')
            expect(detail.entrants).toHaveLength(2)
            expect(detail.stage?.id).toBe('opening')
            expect(
                (await firestore.collection('tournaments').doc(id).collection('stages').get()).size
            ).toBe(1)
            const winner = users.find((user) =>
                detail.entrants.some((entrant) => entrant.userId === user.id)
            )!
            await service.join(id, winner)
            expect((await service.get(id, admin)).tournament.entrantCount).toBe(2)
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
            await service.reconcileDue()
            const detail = await service.get(id, admin)
            expect(detail.tournament.status).toBe('locked')
            expect(detail.tournament.entrantCount).toBe(2)
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
            await service.reconcileDue()
            expect((await service.get(dated, admin)).tournament.cancellationReason).toBe(
                'undersubscribed'
            )
            expect((await service.get(indefinite, admin)).tournament.status).toBe('open')
            expect((await service.get(dated, admin)).stage).toBeUndefined()
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
            expect((await store.read(id))?.tournament.status).toBe('cancelled')
        })

        it('keeps join/leave races consistent with the final locked roster', async () => {
            const id = await open()
            await service.join(id, users[1])
            await Promise.allSettled([service.leave(id, users[1]), service.join(id, users[2])])
            const detail = await service.get(id, admin)
            expect(detail.tournament.entrantCount).toBe(detail.entrants.length)
            expect(detail.tournament.status).toBe(detail.entrants.length === 2 ? 'locked' : 'open')
            expect(Boolean(detail.stage)).toBe(detail.tournament.status === 'locked')
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
                    notification: expect.objectContaining({ data: { tournament: created } })
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
                        data: { tournament: expect.objectContaining({ status: 'open' }) }
                    })
                })
            )
            await service.join(created.id, users[1])
            expect(sendNotification).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    topics: ['global'],
                    notification: expect.objectContaining({
                        data: { tournament: expect.objectContaining({ entrantCount: 1 }) }
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
                        rules: { ...template.rules, titleId }
                    })
                    batch.set(
                        firestore
                            .collection('users')
                            .doc(users[5].id)
                            .collection('tournamentEntries')
                            .doc(eventId),
                        { tournamentId: eventId, titleId }
                    )
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
