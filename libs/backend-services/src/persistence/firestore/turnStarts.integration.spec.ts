import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { Firestore } from '@google-cloud/firestore'
import { createClient, type RedisClientType } from 'redis'
import {
    ActionSource,
    GameStatus,
    PlayerStatus,
    type Game,
    type GameAction,
    type GameState
} from '@tabletop/common'
import { cacheFixture } from '../../cache/tests/cacheFixture.js'
import { UpdateValidationResult } from '../stores/validator.js'
import { FirestoreGameStore } from './gameStore.js'
import { isolatedFirestore } from './tests/isolatedFirestore.js'

describe.skipIf(!process.env.CACHE_TEST_REDIS_HOST || !process.env.FIRESTORE_EMULATOR_HOST)(
    'turn start times in the game store',
    () => {
        let db: Firestore
        let client: RedisClientType
        let live: ReturnType<typeof cacheFixture>
        let store: FirestoreGameStore
        let gameId: string

        function waitingGame(): Game {
            return {
                id: gameId,
                typeId: 'title',
                ownerId: 'a-user',
                name: 'turn starts',
                isPublic: false,
                deleted: false,
                hotseat: false,
                config: {},
                createdAt: new Date(),
                status: GameStatus.WaitingToStart,
                winningPlayerIds: [],
                players: ['a', 'b'].map((id) => ({
                    id,
                    userId: `${id}-user`,
                    name: id,
                    isHuman: true,
                    status: PlayerStatus.Joined
                }))
            }
        }

        function state(actionCount: number, activePlayerIds: string[]): GameState {
            return {
                id: gameId,
                gameId,
                players: [],
                activePlayerIds,
                actionCount,
                actionChecksum: 0,
                prng: { seed: 1, invocations: 0 },
                machineState: 'playing',
                turnManager: { series: [], turnOrder: [], turnCounts: {} },
                winningPlayerIds: []
            }
        }

        async function move(index: number, activePlayerIds: string[]): Promise<Game> {
            const current = await store.findGameById(gameId, true)
            expect(current).toBeDefined()
            const action: GameAction = {
                id: `action-${index}`,
                gameId,
                source: ActionSource.System,
                type: 'step',
                index
            }
            const newState = state(index + 1, activePlayerIds)
            const { updatedGame } = await store.addActionsToGame({
                game: current!,
                state: newState,
                actions: [action],
                validator: async (_game, _state, _newState, _actions, gameUpdates) => {
                    gameUpdates.activePlayerIds = activePlayerIds
                    return UpdateValidationResult.Proceed
                }
            })
            return updatedGame
        }

        async function stored(): Promise<Game | undefined> {
            for await (const keys of client.scanIterator({ MATCH: `*${gameId}*`, COUNT: 100 }))
                if (keys.length) await client.del(keys)
            return store.findGameById(gameId)
        }

        beforeEach(async () => {
            gameId = `turn-starts-${randomUUID()}`
            db = isolatedFirestore({ ignoreUndefinedProperties: true })
            client = createClient({
                socket: { host: process.env.CACHE_TEST_REDIS_HOST, reconnectStrategy: false }
            })
            await client.connect()
            live = cacheFixture(client)
            store = new FirestoreGameStore(live.cache, db)
        })

        afterEach(async () => {
            try {
                await db.recursiveDelete(db.doc(`games/${gameId}`))
            } finally {
                live.cache.destroy()
                client.destroy()
                await db.terminate()
            }
        })

        it('starts each turn when its player becomes active and keeps it while they stay', async () => {
            await store.createGame(waitingGame())
            const [started] = await store.updateGame({
                game: waitingGame(),
                fields: {
                    status: GameStatus.Started,
                    startedAt: new Date(),
                    state: state(0, ['a'])
                },
                validator: (_existing, fields) => {
                    fields.activePlayerIds = ['a']
                    return UpdateValidationResult.Proceed
                }
            })
            const aStarted = started.turnStartedAt?.a
            expect(aStarted).toBeInstanceOf(Date)

            const stillA = await move(0, ['a'])
            expect(stillA.turnStartedAt).toEqual({ a: aStarted })

            const toB = await move(1, ['b'])
            expect(toB.turnStartedAt?.a).toBeUndefined()
            expect(toB.turnStartedAt?.b).toEqual(toB.lastActionAt)
            expect((await stored())?.turnStartedAt).toEqual(toB.turnStartedAt)

            await move(2, [])
            expect((await stored())?.turnStartedAt).toBeUndefined()
        })

        it('starts the turns of a game created already started', async () => {
            await store.createGame({
                ...waitingGame(),
                status: GameStatus.Started,
                activePlayerIds: ['a', 'b'],
                state: state(0, ['a', 'b'])
            })
            const created = await stored()
            expect(Object.keys(created?.turnStartedAt ?? {})).toEqual(['a', 'b'])
        })
    }
)
