import { createClient, type RedisClientType } from 'redis'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import {
    ActionSource,
    assertExists,
    Color,
    GameResult,
    NotificationCategory,
    Role,
    UserStatus,
    type LeagueDraft,
    type TournamentListQuery,
    type User,
    type LeagueGroupSizes
} from '@tabletop/common'
import { cacheFixture } from '../cache/tests/cacheFixture.js'
import { FirestoreGameStore } from '../persistence/firestore/gameStore.js'
import { FirestoreTournamentStore } from '../persistence/firestore/tournamentStore.js'
import { FirestoreLeagueStore } from '../persistence/firestore/leagueStore.js'
import { isolatedFirestore } from '../persistence/firestore/tests/isolatedFirestore.js'
import { GameService } from '../games/gameService.js'
import { UserService } from '../users/userService.js'
import { TokenService } from '../tokens/tokenService.js'
import { LocalTaskService } from '../tasks/localTasksService.js'
import type { TaskService } from '../tasks/taskService.js'
import { DefaultNotificationService } from '../notifications/defaultNotificationService.js'
import { SyntheticDefinition, SyntheticRuntime } from '../games/tests/syntheticGame.js'
import { UpdateValidationResult } from '../persistence/stores/validator.js'
import { TournamentService } from './tournamentService.js'
import { LeagueService } from './leagueService.js'

const sevens: LeagueGroupSizes = { groupSize: 7, bottomMinimum: 5, bottomMaximum: 11 }

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
    'League seasons with Firestore and Redis',
    { timeout: 60000 },
    () => {
        const prefix = `demo-league-${randomUUID()}`
        const db = isolatedFirestore({ ignoreUndefinedProperties: true })
        const client: RedisClientType = createClient({
            socket: { host: process.env.CACHE_TEST_REDIS_HOST, reconnectStrategy: false }
        })
        const { cache, pool, guardPool } = cacheFixture(client)
        const gameStore = new FirestoreGameStore(cache, db, prefix)
        const tournamentStore = new FirestoreTournamentStore(cache, db, prefix)
        const leagueStore = new FirestoreLeagueStore(cache, db, `${prefix}-leagues`)
        const users: User[] = Array.from({ length: 24 }, (_, index) => ({
            id: `${prefix}-user-${index}`,
            username: `Player ${index}`,
            email: `player${index}@example.test`,
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
        const localTasks: LocalTaskService = Object.create(LocalTaskService.prototype)
        const games = new GameService(
            gameStore,
            userService,
            TokenService.prototype,
            localTasks,
            notifications,
            cache,
            { synthetic: definition }
        )
        const enqueue = vi.fn<TaskService['createPushTask']>(async () => undefined)
        let now = Date.now()
        const clock = () => now
        const tournaments = new TournamentService(
            tournamentStore,
            userService,
            { synthetic: definition },
            notifications,
            games,
            { createPushTask: enqueue },
            clock
        )
        const leagueNotifications = { sendNotification: vi.fn(async () => undefined) }
        const leagues = new LeagueService(
            leagueStore,
            tournaments,
            userService,
            { createPushTask: enqueue },
            leagueNotifications,
            clock
        )
        const draft: LeagueDraft = {
            name: 'Synthetic League',
            description: '',
            shape: 'pyramid',
            rules: {
                titleId: 'synthetic',
                tableSize: 4,
                gamesPerEntrant: 4,
                concurrency: 4,
                gameConfig: {},
                scoring: 'splitWinsV1'
            },
            signUp: { opensAutomatically: true, days: 7 }
        }

        beforeAll(async () => {
            await client.connect()
            await Promise.all([...users, admin].map((user) => db.doc(`users/${user.id}`).set(user)))
            vi.spyOn(userService, 'getUsers').mockImplementation(async (ids) =>
                ids.map((id) => [...users, admin].find((user) => user.id === id))
            )
            vi.spyOn(userService, 'getUser').mockImplementation(async (id) =>
                [...users, admin].find((user) => user.id === id)
            )
            vi.spyOn(userService, 'getUserByUsername').mockImplementation(async (name) =>
                [...users, admin].find((user) => user.username === name)
            )
            vi.spyOn(notifications, 'sendNotification').mockResolvedValue()
            vi.spyOn(localTasks, 'createPushTask').mockResolvedValue()
            vi.spyOn(localTasks, 'sendGameInvitationEmail').mockRejectedValue(
                new Error('Must not invite')
            )
        })
        afterAll(async () => {
            vi.restoreAllMocks()
            await pool.close()
            await guardPool.close()
            for await (const keys of client.scanIterator({ MATCH: `*${prefix}*`, COUNT: 100 }))
                if (keys.length) await client.del(keys)
            client.destroy()
            for (const collection of await db.listCollections())
                await db.recursiveDelete(collection)
            await db.terminate()
        })

        async function finishGame(gameId: string) {
            const game = await gameStore.findGameById(gameId, true)
            assertExists(game?.state)
            await gameStore.addActionsToGame({
                game,
                state: {
                    ...game.state,
                    result: GameResult.Win,
                    winningPlayerIds: [game.players[0].id]
                },
                actions: [
                    {
                        id: 'finish',
                        gameId,
                        source: ActionSource.System,
                        type: 'finish',
                        index: 0
                    }
                ],
                validator: async () => UpdateValidationResult.Proceed
            })
        }

        const emails = (kind: string) =>
            enqueue.mock.calls
                .map(([task]) => task)
                .filter(
                    (task) =>
                        task.path === '/leagues/email' &&
                        typeof task.payload === 'object' &&
                        task.payload !== null &&
                        'kind' in task.payload &&
                        task.payload.kind === kind
                )

        async function playSeason(leagueId: string) {
            const { season } = await leagues.get(leagueId, undefined, admin)
            assertExists(season?.groups)
            for (const group of season.groups)
                await tournaments.runTask({ tournamentId: group.tournamentId })
            const running = await leagues.get(leagueId, undefined, admin)
            for (const group of running.groups) {
                expect(group.finishedGames).toBe(0)
                expect(group.totalGames).toBe(group.entrantIds.length)
                expect(group.standings.every((row) => row.active === 4)).toBe(true)
            }
            for (const group of season.groups)
                for (const link of await tournamentStore.readGameLinks(group.tournamentId))
                    await finishGame(link.gameId)
            enqueue.mockClear()
            for (const group of season.groups)
                await tournaments.runTask({ tournamentId: group.tournamentId })
            expect(enqueue).toHaveBeenCalledWith(
                expect.objectContaining({
                    path: '/leagues/advance',
                    payload: { leagueId }
                })
            )
            await leagues.runTask({ leagueId })
            const finished = await leagues.get(leagueId, season.number, admin)
            for (const group of finished.groups) {
                expect(group.finishedGames).toBe(group.totalGames)
                expect(group.standings.every((row) => row.active === 0)).toBe(true)
            }
        }

        it('seeds Levels in Season 0, then promotes, relegates and fills a Vacancy', async () => {
            const id = `${prefix}-league`
            await leagues.create(id, draft, admin)
            await expect(leagues.list(users[0])).resolves.toEqual([])

            const opened = await leagues.publish(id, now + 60_000, admin)
            expect(opened.season).toMatchObject({ number: 0, status: 'signUp', heldPlaces: [] })
            expect(emails('signUpOpen')).toEqual([])
            expect(enqueue).toHaveBeenLastCalledWith(
                expect.objectContaining({ payload: { leagueId: id }, inSeconds: 60 })
            )
            for (const user of users.slice(0, 22)) await leagues.signUp(id, user)
            await leagues.signUp(id, users[0])
            await leagues.withdraw(id, users[21])
            const summary = (user: User) =>
                leagues
                    .list(user)
                    .then((entries) => entries.find((entry) => entry.league.id === id)?.season)
            expect(await summary(users[0])).toMatchObject({
                number: 0,
                status: 'signUp',
                players: 21,
                minimumPlayers: 21,
                myPlace: { status: 'signedUp' }
            })
            expect((await summary(users[21]))?.myPlace).toBeUndefined()

            now += 60_000
            await leagues.runTask({ leagueId: id })
            const seeding = await leagues.get(id, undefined, users[0])
            expect(seeding.season?.status).toBe('inProgress')
            expect(
                seeding.groups.map((group) => [group.groupId, group.level, group.entrantIds.length])
            ).toEqual([
                ['1', 0, 7],
                ['2', 0, 7],
                ['3', 0, 7]
            ])
            expect(seeding.groups.flatMap((group) => group.entrantIds).sort()).toEqual(
                users
                    .slice(0, 21)
                    .map((user) => user.id)
                    .sort()
            )
            expect((await tournamentStore.read(seeding.groups[0].tournamentId))?.league).toEqual({
                leagueId: id,
                leagueName: 'Synthetic League',
                seasonId: '0',
                groupId: '1'
            })

            const groupIds = seeding.groups.map((group) => group.tournamentId)
            const listed = async (user: User, scope: TournamentListQuery['scope']) =>
                (await tournaments.list(user, { scope })).tournaments
                    .map((tournament) => tournament.id)
                    .filter((tournamentId) => groupIds.includes(tournamentId))
            const member = users.find((user) => user.id === seeding.groups[0].entrantIds[0])
            assertExists(member)
            expect(await listed(member, 'mine')).toEqual([groupIds[0]])
            expect(await listed(member, 'inProgress')).toEqual([])
            await playSeason(id)
            expect(await listed(member, 'mine')).toEqual([groupIds[0]])
            expect(await listed(member, 'finished')).toEqual([])
            const seeded = await leagues.get(id, 0, users[0])
            expect(seeded.season?.status).toBe('finished')
            const levelA = seeded.groups.flatMap((group) =>
                group.standings.filter((row) => row.nextLevel === 0)
            )
            expect(levelA).toHaveLength(7)
            expect(levelA.filter((row) => row.place === 1)).toHaveLength(3)
            expect(levelA.filter((row) => row.place === 2)).toHaveLength(3)
            expect(
                seeded.groups.every((group) =>
                    group.standings.every((row) => row.movement === 'seeded')
                )
            ).toBe(true)

            expect(emails('seasonResults')).toHaveLength(21)
            expect(seeded.season?.resultsEmailedAt).toBeDefined()
            const seededResult = await leagues.emailContent({
                leagueId: id,
                season: 0,
                userId: users[0].id,
                kind: 'seasonResults'
            })
            expect(seededResult).toMatchObject({ kind: 'seasonResults', movement: 'seeded' })
            expect(seededResult && 'champion' in seededResult).toBe(false)
            expect(
                seededResult?.kind === 'seasonResults' &&
                    seededResult.standings.filter((row) => row.recipient)
            ).toHaveLength(1)
            expect(seededResult?.kind === 'seasonResults' && seededResult.standings.length).toBe(7)

            const first = await leagues.get(id, undefined, users[0])
            assertExists(first.season)
            expect(first.season).toMatchObject({ number: 1, status: 'signUp', heldFrom: 0 })
            expect(emails('signUpOpen')).toHaveLength(21)
            expect(first.season.announcedAt).toBeDefined()
            const reminder = enqueue.mock.calls
                .map(([task]) => task)
                .find((task) => task.path === '/leagues/remind')
            expect(reminder).toMatchObject({
                payload: { leagueId: id, season: 1, closesAt: first.season.signUpClosesAt },
                inSeconds: 5 * 86_400
            })
            await leagues.runTask({ leagueId: id })
            expect(emails('signUpOpen')).toHaveLength(21)

            // A reminder that could not be scheduled leaves the announcement to be retried.
            await leagueStore.updateSeason(id, 1, (season) => {
                delete season.announcedAt
            })
            enqueue.mockClear()
            let reminderFails = true
            enqueue.mockImplementation(async (task) => {
                if (task.path !== '/leagues/remind' || !reminderFails) return
                reminderFails = false
                throw new Error('Queue unavailable')
            })
            await expect(leagues.runTask({ leagueId: id })).rejects.toThrow('Queue unavailable')
            expect(emails('signUpOpen')).toEqual([])
            expect((await leagueStore.readSeason(id, 1))?.announcedAt).toBeUndefined()
            await leagues.runTask({ leagueId: id })
            expect(
                enqueue.mock.calls.filter(([task]) => task.path === '/leagues/remind')
            ).toHaveLength(2)
            expect((await leagueStore.readSeason(id, 1))?.announcedAt).toBeDefined()
            expect(
                seeded.season?.placements?.every((placement) => typeof placement.score === 'number')
            ).toBe(true)
            expect(first.season.signUpClosesAt).toBe(now + 7 * 86_400_000)
            const held = first.season.heldPlaces
            expect(held.filter((place) => place.level === 0)).toHaveLength(7)
            expect(held.filter((place) => place.level === 1)).toHaveLength(14)

            expect(
                (await summary(users.find((user) => user.id === held[0].userId) ?? admin))?.myPlace
            ).toEqual({
                status: 'held',
                level: 0
            })
            const absent = held[0].userId
            const vacancyFiller = held.find((place) => place.level === 1)?.userId
            assertExists(vacancyFiller)
            for (const place of held)
                if (place.userId !== absent)
                    await leagues.signUp(
                        id,
                        users.find((user) => user.id === place.userId) ?? admin
                    )
            for (const user of users.slice(21, 24)) await leagues.signUp(id, user)
            expect(await leagues.preview(id, admin)).toHaveLength(3)

            enqueue.mockClear()
            await leagues.runReminder({
                leagueId: id,
                season: 1,
                closesAt: first.season.signUpClosesAt
            })
            expect(emails('signUpReminder')).toEqual([])
            expect(enqueue).toHaveBeenCalledWith(
                expect.objectContaining({ path: '/leagues/remind', inSeconds: 5 * 86_400 })
            )
            now = first.season.signUpClosesAt - 86_400_000
            enqueue.mockClear()
            const remind = {
                leagueId: id,
                season: 1,
                closesAt: first.season.signUpClosesAt
            }
            await leagues.runReminder(remind)
            await leagues.runReminder(remind)
            expect(emails('signUpReminder').map((task) => task.payload)).toEqual([
                { ...remind, userId: absent, kind: 'signUpReminder' }
            ])
            await expect(
                leagues.emailContent({ ...remind, userId: vacancyFiller, kind: 'signUpReminder' })
            ).resolves.toBeUndefined()

            const movedClose = { ...remind, closesAt: remind.closesAt + 3 * 86_400_000 }
            await leagues.setSignUpClose(id, movedClose.closesAt, admin)
            now = movedClose.closesAt - 86_400_000
            enqueue.mockClear()
            await leagues.runReminder(movedClose)
            expect(emails('signUpReminder').map((task) => task.payload)).toEqual([
                { ...movedClose, userId: absent, kind: 'signUpReminder' }
            ])
            await expect(
                leagues.emailContent({ ...remind, userId: absent, kind: 'signUpReminder' })
            ).resolves.toBeUndefined()
            await expect(
                leagues.emailContent({ ...movedClose, userId: absent, kind: 'signUpReminder' })
            ).resolves.toMatchObject({ closesAt: movedClose.closesAt })

            now = movedClose.closesAt
            await leagues.runTask({ leagueId: id })
            const started = await leagues.get(id, undefined, users[0])
            expect(started.season?.status).toBe('inProgress')
            expect(started.groups.map((group) => [group.groupId, group.entrantIds.length])).toEqual(
                [
                    ['A', 7],
                    ['B1', 8],
                    ['B2', 8]
                ]
            )
            const groupA = started.groups[0].entrantIds
            expect(groupA).toContain(vacancyFiller)
            expect(emails('seasonStart')).toHaveLength(23)
            const moved = await Promise.all(
                started.groups
                    .flatMap((group) => group.entrantIds)
                    .map(async (userId) => {
                        const content = await leagues.emailContent({
                            leagueId: id,
                            season: 1,
                            userId,
                            kind: 'seasonStart'
                        })
                        return content?.kind === 'seasonStart' && content.level?.moved === 'up'
                            ? userId
                            : []
                    })
            )
            expect(moved.flat()).toEqual([vacancyFiller])
            expect(groupA).not.toContain(absent)
            for (const user of users.slice(21, 24)) expect(groupA).not.toContain(user.id)

            await leagues.runTask({ leagueId: id })
            expect((await leagues.get(id, undefined, users[0])).season?.revision).toBe(
                started.season?.revision
            )

            await playSeason(id)
            const finished = await leagues.get(id, 1, users[0])
            expect(finished.season?.status).toBe('finished')
            const movement = (groupId: string, kind: string) =>
                finished.groups
                    .find((group) => group.groupId === groupId)
                    ?.standings.filter((row) => row.movement === kind)
                    .map((row) => row.place)
            expect(movement('A', 'relegated')).toEqual([6, 7])
            expect(movement('A', 'promoted')).toEqual([])
            for (const groupId of ['B1', 'B2']) {
                expect(movement(groupId, 'promoted')).toEqual([1])
                expect(movement(groupId, 'relegated')).toEqual([])
            }
            expect(emails('seasonResults')).toHaveLength(23)
            const winner = finished.groups[0].standings.find((row) => row.place === 1)
            assertExists(winner)
            const lastInB1 = finished.groups[1].standings.at(-1)
            assertExists(lastInB1)
            const result = await leagues.emailContent({
                leagueId: id,
                season: 1,
                userId: lastInB1.userId,
                kind: 'seasonResults'
            })
            expect(result).toMatchObject({
                kind: 'seasonResults',
                groupName: 'B1',
                place: 8,
                champion: users.find((user) => user.id === winner.userId)?.username
            })
            expect(result?.kind === 'seasonResults' && result.standings.length).toBe(8)
            enqueue.mockClear()
            await leagues.runTask({ leagueId: id })
            expect(emails('seasonResults')).toEqual([])

            const second = await leagues.get(id, undefined, users[0])
            expect(second.season?.number).toBe(2)
            expect(second.season?.heldPlaces.filter((place) => place.level === 0)).toHaveLength(7)
        })

        it('keeps sign-up open below two full Levels until an administrator moves the close', async () => {
            const id = `${prefix}-short`
            await leagues.create(id, draft, admin)
            await leagues.publish(id, now + 1000, admin)
            for (const user of users.slice(0, 20)) await leagues.signUp(id, user)
            now += 1000
            await leagues.runTask({ leagueId: id })
            const short = await leagues.get(id, undefined, admin)
            expect(short.season).toMatchObject({ status: 'signUp', undersubscribed: true })
            expect(short.season?.nextTaskAt).toBeUndefined()

            await leagues.signUp(id, users[20])
            await leagues.setSignUpClose(id, now + 1000, admin)
            now += 1000
            await leagues.runTask({ leagueId: id })
            expect((await leagues.get(id, undefined, admin)).season?.status).toBe('inProgress')
        })

        it('cancels a season in sign-up and reopens it as a seeding season', async () => {
            const id = `${prefix}-cancelled`
            const leagueUpdate = expect.objectContaining({
                notification: expect.objectContaining({
                    type: NotificationCategory.League,
                    action: 'update',
                    data: { leagueId: id }
                }),
                topics: ['global']
            })
            leagueNotifications.sendNotification.mockClear()
            const created = await leagues.create(id, draft, admin)
            await leagues.update(id, draft, created.revision, admin)
            expect(leagueNotifications.sendNotification).not.toHaveBeenCalled()
            await leagues.publish(id, now + 1000, admin)
            expect(leagueNotifications.sendNotification).toHaveBeenCalledWith(leagueUpdate)
            for (const user of users.slice(0, 5)) await leagues.signUp(id, user)
            await expect(leagues.cancelSeason(id, users[0])).rejects.toThrow('Administrator')
            leagueNotifications.sendNotification.mockClear()
            const cancelled = await leagues.cancelSeason(id, admin)
            expect(leagueNotifications.sendNotification).toHaveBeenCalledExactlyOnceWith(
                leagueUpdate
            )
            leagueNotifications.sendNotification.mockClear()
            await leagues.updateSignUpPolicy(id, cancelled.league.signUp, admin)
            expect(leagueNotifications.sendNotification).not.toHaveBeenCalled()
            expect(cancelled.season).toMatchObject({ number: 0, status: 'cancelled' })
            expect(cancelled.season?.nextTaskAt).toBeUndefined()
            await expect(leagues.signUp(id, users[6])).rejects.toThrow('Sign-up is closed')
            now += 1000
            await leagues.runTask({ leagueId: id })
            expect((await leagues.get(id, 0, admin)).season?.status).toBe('cancelled')

            const reopened = await leagues.openNextSeason(id, now + 1000, admin)
            expect(reopened.season).toMatchObject({
                number: 1,
                seeding: true,
                status: 'signUp',
                heldPlaces: [],
                newEntrants: []
            })
            for (const user of users.slice(0, 21)) await leagues.signUp(id, user)
            now += 1000
            await leagues.runTask({ leagueId: id })
            const started = await leagues.get(id, undefined, admin)
            expect(started.season?.status).toBe('inProgress')
            expect(started.groups.map((group) => group.groupId)).toEqual(['1', '2', '3'])
            await expect(leagues.cancelSeason(id, admin)).rejects.toThrow(
                'Only a season still in sign-up'
            )

            const manual = { opensAutomatically: false, days: 3 }
            await expect(leagues.updateSignUpPolicy(id, manual, users[0])).rejects.toThrow(
                'Administrator'
            )
            expect((await leagues.updateSignUpPolicy(id, manual, admin)).signUp).toEqual(manual)
            await playSeason(id)
            const finished = await leagues.get(id, undefined, admin)
            expect(finished.season).toMatchObject({ number: 1, status: 'finished' })
            expect(emails('seasonResults')).toHaveLength(21)
            expect(emails('signUpOpen')).toEqual([])
        })

        it('drops a withdrawn player and holds a Bottom Level place for a substitute', async () => {
            const id = `${prefix}-dropouts`
            await leagues.create(id, draft, admin)
            await leagues.publish(id, now + 1000, admin)
            for (const user of users.slice(0, 21)) await leagues.signUp(id, user)
            now += 1000
            await leagues.runTask({ leagueId: id })
            const { season } = await leagues.get(id, undefined, admin)
            assertExists(season?.groups)
            for (const group of season.groups)
                await tournaments.runTask({ tournamentId: group.tournamentId })
            const [first, second] = season.groups
            const replaced = first.entrantIds[0]
            const leaving = second.entrantIds[0]
            const substitute = users[23]
            const revision = async (tournamentId: string) =>
                (await tournamentStore.read(tournamentId))?.revision ?? 0
            await tournaments.substituteEntrant(
                first.tournamentId,
                {
                    revision: await revision(first.tournamentId),
                    userId: replaced,
                    substituteUsername: substitute.username ?? '',
                    tables: {}
                },
                admin
            )
            await tournaments.withdrawEntrant(
                second.tournamentId,
                { revision: await revision(second.tournamentId), userId: leaving },
                admin
            )
            const live = await leagues.get(id, undefined, admin)
            expect(live.groups[0].standings.find((row) => row.userId === replaced)?.playedBy).toBe(
                substitute.id
            )
            expect(live.groups[1].standings.at(-1)).toMatchObject({
                userId: leaving,
                withdrawn: true
            })
            expect(live.usernames[substitute.id]).toBe(substitute.username)
            await leagues.runTask({ leagueId: id })
            const myPlace = async (user: User) =>
                (await leagues.list(user)).find((entry) => entry.league.id === id)?.season?.myPlace
            expect(await myPlace(substitute)).toMatchObject({
                status: 'inGroup',
                groupId: first.groupId
            })
            const account = (userId: string) => users.find((user) => user.id === userId) ?? admin
            expect(await myPlace(account(replaced))).toBeUndefined()
            expect(await myPlace(account(leaving))).toBeUndefined()

            for (let round = 0; round < 10; round++) {
                const groups = await tournamentStore.readMany(
                    season.groups.map((group) => group.tournamentId)
                )
                if (groups.every((group) => group?.status === 'finished')) break
                for (const group of season.groups) {
                    const active = new Set(
                        (await tournamentStore.read(group.tournamentId))?.stages[0].dispatch?.active
                    )
                    for (const link of await tournamentStore.readGameLinks(group.tournamentId))
                        if (active.has(link.tableId)) await finishGame(link.gameId)
                    await tournaments.runTask({ tournamentId: group.tournamentId })
                }
            }
            enqueue.mockClear()
            await leagues.runTask({ leagueId: id })
            const finished = await leagues.get(id, 0, admin)
            const placements = finished.season?.placements ?? []
            expect(placements).toHaveLength(20)
            expect(placements.some((placement) => placement.userId === leaving)).toBe(false)
            expect(
                placements.find((placement) => placement.userId === replaced)?.substituteId
            ).toBe(substitute.id)
            const next = await leagues.get(id, undefined, admin)
            const held = next.season?.heldPlaces ?? []
            expect(
                held.some((place) => place.userId === replaced || place.userId === leaving)
            ).toBe(false)
            expect(held.find((place) => place.userId === substitute.id)?.level).toBe(
                Math.max(...held.map((place) => place.level))
            )
            const recipients = emails('seasonResults').map((task) =>
                typeof task.payload === 'object' && task.payload && 'userId' in task.payload
                    ? task.payload.userId
                    : undefined
            )
            expect(recipients).toContain(substitute.id)
            expect(recipients).not.toContain(replaced)
            expect(recipients).not.toContain(leaving)
            await expect(
                leagues.emailContent({
                    leagueId: id,
                    season: 0,
                    userId: substitute.id,
                    kind: 'seasonResults'
                })
            ).resolves.toMatchObject({ movement: 'substitute', nextLevel: 'B' })
        })

        it('rejects sign-up after the close and sets Group sizes from the preset', async () => {
            const id = `${prefix}-closed`
            await leagues.create(id, draft, admin)
            await leagues.publish(id, now + 1000, admin)
            now += 1000
            await expect(leagues.signUp(id, users[0])).rejects.toThrow('Sign-up is closed')
            const sized = await leagues.create(`${prefix}-sized`, draft, admin)
            expect(sized.rules.sizes).toEqual(sevens)
        })
    }
)
