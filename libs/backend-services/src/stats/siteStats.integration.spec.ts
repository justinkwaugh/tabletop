import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { Firestore } from '@google-cloud/firestore'
import { createClient, type RedisClientType } from 'redis'
import {
    ActionSource,
    assertExists,
    GameStatus,
    PlayerStatus,
    UserStatus,
    type Game,
    type GameAction
} from '@tabletop/common'
import { cacheFixture } from '../cache/tests/cacheFixture.js'
import { FirestoreGameStore } from '../persistence/firestore/gameStore.js'
import { FirestoreUserStore } from '../persistence/firestore/userStore.js'
import { FirestoreSiteStatsStore } from '../persistence/firestore/siteStatsStore.js'
import { isolatedFirestore } from '../persistence/firestore/tests/isolatedFirestore.js'
import { SiteStatsService } from './siteStatsService.js'

const DAY = '2026-10-17'
const at = (time: string) => new Date(`${DAY}T${time}Z`)
const dayBefore = (time: string) => new Date(`2026-10-16T${time}Z`)

describe.skipIf(!process.env.CACHE_TEST_REDIS_HOST || !process.env.FIRESTORE_EMULATOR_HOST)(
    'Site stats rollup against Firestore and Redis',
    () => {
        let db: Firestore
        let client: RedisClientType
        let live: ReturnType<typeof cacheFixture>
        let games: FirestoreGameStore
        let service: SiteStatsService
        let prefix: string

        function game(id: string, overrides: Partial<Game> = {}): Game {
            return {
                id: `${prefix}-${id}`,
                typeId: 'sol',
                ownerId: 'owner',
                name: id,
                isPublic: false,
                deleted: false,
                hotseat: false,
                config: {},
                createdAt: dayBefore('08:00:00'),
                startedAt: dayBefore('09:00:00'),
                lastActionAt: at('10:00:00'),
                status: GameStatus.Started,
                winningPlayerIds: [],
                players: ['a', 'b'].map((playerId) => ({
                    id: playerId,
                    userId: `user-${playerId}`,
                    name: playerId,
                    isHuman: true,
                    status: PlayerStatus.Joined
                })),
                ...overrides
            }
        }

        function action(
            gameId: string,
            index: number,
            playerId: string,
            createdAt: Date,
            source = ActionSource.User
        ): GameAction {
            return { id: `${gameId}-${index}`, gameId, source, type: 'move', playerId, index, createdAt }
        }

        async function seedChunk(gameId: string, number: number, actions: GameAction[]) {
            const createdAt = actions[0].createdAt
            await db
                .collection('games')
                .doc(gameId)
                .collection('actionChunks')
                .doc(`chunk-${gameId}-${number}`)
                .set({
                    id: `chunk-${gameId}-${number}`,
                    gameId,
                    startIndex: actions[0].index,
                    endIndex: (actions.at(-1)?.index ?? 0) + 1,
                    createdAt,
                    updatedAt: actions.at(-1)?.createdAt,
                    actionsData: JSON.stringify(actions),
                    actionIds: actions.map((item) => item.id)
                })
        }

        beforeEach(async () => {
            prefix = `site-stats-${randomUUID()}`
            db = isolatedFirestore({ ignoreUndefinedProperties: true })
            client = createClient({
                socket: { host: process.env.CACHE_TEST_REDIS_HOST, reconnectStrategy: false }
            })
            await client.connect()
            live = cacheFixture(client)
            games = new FirestoreGameStore(live.cache, db)
            service = new SiteStatsService(
                games,
                new FirestoreUserStore(live.cache, db),
                new FirestoreSiteStatsStore(db),
                { createPushTask: async () => undefined },
                () => new Date('2026-10-18T00:10:00Z')
            )
        })

        afterEach(async () => {
            live.cache.destroy()
            client.destroy()
            await db.terminate()
        })

        it('reads only the games in play during the day', async () => {
            const batch = db.batch()
            for (const record of [
                game('playing'),
                game('later', { startedAt: new Date('2026-10-18T01:00:00Z') }),
                game('idle', { lastActionAt: dayBefore('20:00:00') })
            ])
                batch.set(games.games.doc(record.id), record)
            await batch.commit()
            const found = await games.findGamesInPlayBetween(
                at('00:00:00'),
                new Date('2026-10-18T00:00:00Z')
            )
            expect(found.map((item) => item.name)).toEqual(['playing'])
        })

        it('reaches back across chunks to the turn before the day', async () => {
            const chunked = game('chunked')
            await db.collection('games').doc(chunked.id).set({ ...chunked, actionChunkSize: 2 })
            await seedChunk(chunked.id, 0, [
                action(chunked.id, 0, 'a', dayBefore('10:00:00')),
                action(chunked.id, 1, 'b', dayBefore('11:00:00'))
            ])
            await seedChunk(chunked.id, 1, [
                action(chunked.id, 2, 'b', dayBefore('11:00:00'), ActionSource.System),
                action(chunked.id, 3, 'a', at('11:00:00'))
            ])
            const stored = await games.findGameById(chunked.id)
            assertExists(stored, 'The seeded game should be readable')
            const found = await games.findPlayActionsBetween(
                stored,
                at('00:00:00'),
                new Date('2026-10-18T00:00:00Z')
            )
            expect(found.actions.map((item) => item.index)).toEqual([0, 1, 2, 3])
            expect(found.actions[3].createdAt).toEqual(at('11:00:00'))
            expect(found.includesFirstAction).toBe(true)
        })

        it('reads legacy action records for the day and the turn before it', async () => {
            const legacy = game('legacy')
            await games.games.doc(legacy.id).set(legacy)
            const actions = db.collection('games').doc(legacy.id).collection('actions')
            for (const record of [
                action(legacy.id, 0, 'a', dayBefore('10:00:00')),
                action(legacy.id, 1, 'b', at('11:00:00')),
                action(legacy.id, 2, 'a', new Date('2026-10-18T01:00:00Z'))
            ])
                await actions.doc(record.id).set(record)
            const stored = await games.findGameById(legacy.id)
            assertExists(stored, 'The seeded game should be readable')
            const found = await games.findPlayActionsBetween(
                stored,
                at('00:00:00'),
                new Date('2026-10-18T00:00:00Z')
            )
            expect(found.actions.map((item) => item.index)).toEqual([0, 1])
            expect(found.includesFirstAction).toBe(true)
        })

        it('rolls up a day and serves it as a range', async () => {
            const played = game('played')
            await db.collection('games').doc(played.id).set({ ...played, actionChunkSize: 200 })
            await seedChunk(played.id, 0, [
                action(played.id, 0, 'a', dayBefore('22:00:00')),
                action(played.id, 1, 'b', at('01:00:00')),
                action(played.id, 2, 'a', at('02:00:00'))
            ])
            const created = game('created', { createdAt: at('05:00:00'), startedAt: undefined })
            await games.games.doc(created.id).set(created)
            await db.collection('users').doc(`${prefix}-new`).set({
                id: `${prefix}-new`,
                status: UserStatus.Active,
                createdAt: at('03:00:00'),
                roles: [],
                externalIds: []
            })

            const stats = await service.rollupDay(DAY)
            expect(stats).toMatchObject({
                newUsers: 1,
                games: { created: 1, started: 0, finished: 0, abandoned: 0 },
                userActions: 2,
                activeUsers: 2,
                activeUsers7d: 2
            })
            expect(stats.turnTimes.reduce((total, count) => total + count, 0)).toBe(2)

            const range = await service.getRange('2026-10-10', DAY)
            expect(range.days.map((day) => day.day)).toEqual([DAY])
            expect(range).toMatchObject({
                rolledThrough: DAY,
                activeUsers: 2,
                titleActiveUsers: { sol: 2 }
            })
        })
    }
)
