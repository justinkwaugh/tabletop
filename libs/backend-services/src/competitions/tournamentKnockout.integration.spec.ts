import { createClient, type RedisClientType } from 'redis'
import { randomUUID } from 'node:crypto'
import * as Type from 'typebox'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import {
    assertExists,
    ActionSource,
    BaseConfigurator,
    Color,
    ConfigOptionType,
    GameResult,
    GameStatus,
    Role,
    UserStatus,
    type GameConfigOptions,
    type Tournament,
    type User
} from '@tabletop/common'
import { cacheFixture } from '../cache/tests/cacheFixture.js'
import { FirestoreGameStore } from '../persistence/firestore/gameStore.js'
import { FirestoreTournamentStore } from '../persistence/firestore/tournamentStore.js'
import { isolatedFirestore } from '../persistence/firestore/tests/isolatedFirestore.js'
import { GameService } from '../games/gameService.js'
import { UserService } from '../users/userService.js'
import { TokenService } from '../tokens/tokenService.js'
import { LocalTaskService } from '../tasks/localTasksService.js'
import type { TaskService } from '../tasks/taskService.js'
import { DefaultNotificationService } from '../notifications/defaultNotificationService.js'
import { SyntheticDefinition, SyntheticRuntime } from '../games/tests/syntheticGame.js'
import { TournamentService } from './tournamentService.js'
import { UpdateValidationResult } from '../persistence/stores/validator.js'
import { tournamentGameId } from '../games/tournamentGames.js'

class Configurator extends BaseConfigurator {
    schema = Type.Object({ sides: Type.String() }, { additionalProperties: false })
    options: GameConfigOptions = [
        {
            id: 'sides',
            name: 'Sides',
            description: '',
            type: ConfigOptionType.List,
            default: 'seat',
            options: [
                { name: 'By seat', value: 'seat' },
                { name: 'Auction', value: 'auction' }
            ]
        }
    ]
}

const definition = {
    ...SyntheticDefinition,
    info: {
        ...SyntheticDefinition.info,
        metadata: { ...SyntheticDefinition.info.metadata, minPlayers: 2, maxPlayers: 4 },
        configurator: new Configurator()
    },
    runtime: {
        ...SyntheticRuntime,
        playerColors: [Color.Red, Color.Blue, Color.Green, Color.Yellow],
        randomnessVersion: 1 as const
    }
}

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST || !process.env.CACHE_TEST_REDIS_HOST)(
    'Knockout tournaments with Firestore and Redis',
    { timeout: 20000 },
    () => {
        const prefix = `demo-knockout-${randomUUID()}`
        const db = isolatedFirestore({ ignoreUndefinedProperties: true })
        const client: RedisClientType = createClient({
            socket: { host: process.env.CACHE_TEST_REDIS_HOST, reconnectStrategy: false }
        })
        const { cache, pool, guardPool } = cacheFixture(client)
        const store = new FirestoreGameStore(cache, db, { tournamentCachePrefix: prefix })
        const tournaments = new FirestoreTournamentStore(cache, db, prefix)
        const users: User[] = Array.from({ length: 5 }, (_, index) => ({
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
        const everyone = [...users, admin]
        const userService: UserService = Object.create(UserService.prototype)
        const notifications: DefaultNotificationService = Object.create(
            DefaultNotificationService.prototype
        )
        const tasks: LocalTaskService = Object.create(LocalTaskService.prototype)
        const titles = { synthetic: definition }
        const games = new GameService(
            store,
            userService,
            TokenService.prototype,
            tasks,
            notifications,
            cache,
            titles
        )
        const enqueue = vi.fn<TaskService['createPushTask']>(async () => undefined)
        const service = new TournamentService(
            tournaments,
            userService,
            titles,
            notifications,
            games,
            { createPushTask: enqueue }
        )

        beforeAll(async () => {
            await client.connect()
            await Promise.all(everyone.map((user) => db.doc(`users/${user.id}`).set(user)))
            vi.spyOn(userService, 'getUser').mockImplementation(async (id) =>
                everyone.find((user) => user.id === id)
            )
            vi.spyOn(userService, 'getUsers').mockImplementation(async (ids) =>
                ids.map((id) => everyone.find((user) => user.id === id))
            )
            vi.spyOn(notifications, 'sendNotification').mockResolvedValue()
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

        async function lockedKnockout(entrants: User[]): Promise<Tournament> {
            const tournament: Tournament = {
                id: `${prefix}-${randomUUID()}`,
                name: 'Cup',
                description: '',
                organizerId: admin.id,
                shortGameIds: true,
                status: 'locked',
                revision: 1,
                createdAt: 1,
                updatedAt: 1,
                publishedAt: 1,
                lockedAt: 1,
                nextTaskAt: 1,
                entrants: entrants.map((user) => ({ userId: user.id, joinedAt: 1 })),
                stages: [
                    { id: 'bracket', status: 'awaitingSchedule', rosterRevision: 1, createdAt: 1 }
                ],
                format: {
                    kind: 'knockout',
                    stages: [{ id: 'bracket', name: 'Bracket', gamesPerEntrant: 2 }],
                    deciderGameConfig: { sides: 'auction' }
                },
                rules: {
                    titleId: 'synthetic',
                    tableSize: 2,
                    gameConfig: { sides: 'seat' },
                    concurrency: 2,
                    scoring: 'splitWinsV1',
                    registration: { kind: 'whenFull', capacity: entrants.length }
                }
            }
            await tournaments.create(tournament, admin)
            await service.runTask({ tournamentId: tournament.id })
            const current = await tournaments.read(tournament.id)
            assertExists(current)
            return current
        }

        async function tables(id: string) {
            return (await tournaments.readSchedule(id, 'bracket')).tables
        }

        async function gameAt(tournament: Tournament, tableId: string) {
            const current = await tournaments.read(tournament.id)
            assertExists(current)
            const attempt = current.stages[0].dispatch?.attempts?.[tableId]
            const game = await store.findGameById(
                tournamentGameId(current, {
                    tournamentId: current.id,
                    stageId: 'bracket',
                    tableId,
                    ...(attempt ? { attempt } : {})
                }),
                true
            )
            assertExists(game?.state, `Table ${tableId} has no game`)
            return game
        }

        /** Ends a Table's Game with the given account winning, then runs the woken dispatch. */
        async function win(tournament: Tournament, tableId: string, winnerId: string) {
            const game = await gameAt(tournament, tableId)
            const winner = game.players.find((player) => player.userId === winnerId)
            assertExists(winner, `${winnerId} is not at table ${tableId}`)
            await store.addActionsToGame({
                game,
                state: { ...game.state!, result: GameResult.Win, winningPlayerIds: [winner.id] },
                actions: [
                    {
                        id: 'finish',
                        gameId: game.id,
                        source: ActionSource.System,
                        type: 'finish',
                        index: 0
                    }
                ],
                validator: async () => UpdateValidationResult.Proceed
            })
            await service.runTask({ tournamentId: tournament.id })
        }

        function opponents(table: { entrantIds: string[] }) {
            return [...table.entrantIds].sort()
        }

        it('plays a bracket with Byes and Deciders, each Match starting once it is set', async () => {
            const tournament = await lockedKnockout(users)
            const opening = await tables(tournament.id)
            // Five players: three Byes. Seed 4 plays seed 5, and seeds 2 and 3, both drawn
            // against Byes, meet in the semi-final straight away.
            expect(opening.map((table) => table.match)).toEqual([
                { round: 1, index: 1, game: 1 },
                { round: 1, index: 1, game: 2 },
                { round: 2, index: 1, game: 1 },
                { round: 2, index: 1, game: 2 }
            ])
            expect(opening[1].entrantIds).toEqual([...opening[0].entrantIds].reverse())
            const [first, second] = opening[0].entrantIds
            const game = await gameAt(tournament, opening[0].id)
            expect(game).toMatchObject({
                concedable: true,
                name: 'Cup · Quarter-final 2 · Game 1',
                config: { sides: 'seat' }
            })
            expect(game.state?.turnManager.turnOrder).toEqual(
                game.players.map((player) => player.id)
            )
            expect((await gameAt(tournament, opening[2].id)).name).toBe(
                'Cup · Semi-final 2 · Game 1'
            )
            expect(
                (await tournaments.read(tournament.id))?.stages[0].dispatch?.active.sort()
            ).toEqual(opening.map((table) => table.id))

            await win(tournament, opening[0].id, first)
            expect(await tables(tournament.id)).toHaveLength(4)
            await win(tournament, opening[1].id, second)
            const withDecider = await tables(tournament.id)
            expect(withDecider).toHaveLength(5)
            expect(withDecider[4].match).toEqual({ round: 1, index: 1, game: 3 })
            const decider = await gameAt(tournament, withDecider[4].id)
            expect(decider).toMatchObject({
                name: 'Cup · Quarter-final 2 · Decider',
                config: { sides: 'auction' },
                status: GameStatus.Started
            })

            await win(tournament, withDecider[4].id, second)
            // The Decider's winner meets the first seed in the other semi-final.
            const semi = (await tables(tournament.id)).slice(5)
            expect(semi.map((table) => table.match)).toEqual([
                { round: 2, index: 0, game: 1 },
                { round: 2, index: 0, game: 2 }
            ])
            expect(semi[0].entrantIds[1]).toBe(second)

            const detail = await service.get(tournament.id, admin)
            expect(detail.standings?.find((row) => row.userId === first)?.rank).toBe(5)
            expect(detail.tournament.status).toBe('inProgress')
        })

        it('starts Matches between two Byes with the opening draw and finishes the final', async () => {
            const tournament = await lockedKnockout(users.slice(0, 3))
            // Three players: the first seed has a Bye, the other two play.
            const [game1, game2] = await tables(tournament.id)
            const [a, b] = game1.entrantIds
            await win(tournament, game1.id, a)
            await win(tournament, game2.id, a)
            const final = (await tables(tournament.id)).slice(2)
            expect(final).toHaveLength(2)
            expect(final[0].match).toEqual({ round: 2, index: 0, game: 1 })
            const champion = final[0].entrantIds.find((id) => id !== a)
            assertExists(champion)
            expect((await gameAt(tournament, final[0].id)).name).toBe('Cup · Final · Game 1')
            await win(tournament, final[0].id, champion)
            await win(tournament, final[1].id, champion)
            const finished = await tournaments.read(tournament.id)
            expect(finished?.status).toBe('finished')
            expect(finished?.nextTaskAt).toBeUndefined()
            const detail = await service.get(tournament.id, admin)
            expect(
                detail.standings?.map((row) => [row.userId, row.rank, row.champion ?? false])
            ).toEqual([
                [champion, 1, true],
                [a, 2, false],
                [b, 3, false]
            ])
        })

        it('adds no Match for a player withdrawn after dispatch read the Bracket', async () => {
            const tournament = await lockedKnockout(users.slice(0, 4))
            const opening = await tables(tournament.id)
            const [a] = opening[0].entrantIds
            const [b] = opening[2].entrantIds
            await win(tournament, opening[0].id, a)
            await win(tournament, opening[1].id, a)
            await win(tournament, opening[2].id, b)
            const extend = tournaments.extendSchedule.bind(tournaments)
            // The withdrawal lands between dispatch reading the results and adding the final.
            vi.spyOn(tournaments, 'extendSchedule').mockImplementationOnce(async (...args) => {
                await service.withdrawEntrant(
                    tournament.id,
                    { revision: (await tournaments.read(tournament.id))!.revision, userId: a },
                    admin
                )
                return extend(...args)
            })
            await win(tournament, opening[3].id, b)
            expect(await tables(tournament.id)).toHaveLength(4)
            await service.runTask({ tournamentId: tournament.id })
            const detail = await service.get(tournament.id, admin)
            expect(detail.tournament.status).toBe('finished')
            expect(detail.tournament.schedulingError).toBeUndefined()
            expect(detail.standings?.find((row) => row.champion)?.userId).toBe(b)
            // The final the stale Bracket asked for was never added.
            expect(await tables(tournament.id)).toHaveLength(4)
        })

        it('hands a withdrawn player’s Match to the opponent and takes no Substitute', async () => {
            const tournament = await lockedKnockout(users.slice(0, 2))
            const [game1] = await tables(tournament.id)
            const [a, b] = opponents(game1)
            vi.spyOn(userService, 'getUserByUsername').mockResolvedValue(users[4])
            await expect(
                service.substituteEntrant(
                    tournament.id,
                    {
                        revision: (await tournaments.read(tournament.id))!.revision,
                        userId: a,
                        substituteUsername: 'Player 4',
                        tables: {}
                    },
                    admin
                )
            ).rejects.toThrow('no substitute')
            await service.withdrawEntrant(
                tournament.id,
                { revision: (await tournaments.read(tournament.id))!.revision, userId: a },
                admin
            )
            await service.runTask({ tournamentId: tournament.id })
            const finished = await tournaments.read(tournament.id)
            expect(finished?.status).toBe('finished')
            expect(finished?.stages[0].dispatch?.voided).toHaveLength(2)
            const detail = await service.get(tournament.id, admin)
            expect(detail.standings?.find((row) => row.champion)?.userId).toBe(b)
        })
    }
)
