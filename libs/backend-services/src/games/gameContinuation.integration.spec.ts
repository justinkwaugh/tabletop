import { randomUUID } from 'node:crypto'
import { Firestore } from '@google-cloud/firestore'
import { createClient, type RedisClientType } from 'redis'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    GameEngine,
    GameStatus,
    PlayerStatus,
    Role,
    UserStatus,
    type Game,
    type User
} from '@tabletop/common'
import { cacheFixture } from '../cache/tests/cacheFixture.js'
import { gameServiceFixture } from './tests/gameServiceFixture.js'
import {
    ContinuationDefinition as definition,
    finishForContinuation
} from './tests/continuationGame.js'

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST || !process.env.CACHE_TEST_REDIS_HOST)(
    'hosted continuation transactions',
    () => {
        let db: Firestore
        let live: ReturnType<typeof cacheFixture>
        let fixture: ReturnType<typeof gameServiceFixture>
        let source: Game
        let owner: User
        let participants: User[]
        let gameIds: Set<string>

        beforeEach(async () => {
            db = new Firestore({ projectId: 'demo-continuation', ignoreUndefinedProperties: true })
            const client: RedisClientType = createClient({
                socket: { host: process.env.CACHE_TEST_REDIS_HOST, reconnectStrategy: false }
            })
            await client.connect()
            live = cacheFixture(client)
            const prefix = randomUUID()
            participants = [0, 1, 2].map((index) => ({
                id: `${prefix}-${index}`,
                username: `Player ${index}`,
                status: UserStatus.Active,
                roles: [Role.User],
                externalIds: []
            }))
            owner = participants[0]
            fixture = gameServiceFixture(definition, owner, { firestore: db, cache: live.cache })
            fixture.game.id = prefix
            fixture.game.players.forEach((player, index) => {
                player.userId = participants[index].id
            })
            const started = new GameEngine(definition.runtime).startGame(fixture.game)
            source = started.startedGame
            started.initialState.board = [13, 71]
            finishForContinuation(source, started.initialState)
            source.state = started.initialState
            gameIds = new Set([source.id])
            vi.spyOn(fixture.users, 'getUser').mockImplementation(async (id) =>
                participants.find((user) => user.id === id)
            )
            vi.spyOn(fixture.service, 'inviteUserToGame').mockResolvedValue()
            await fixture.store.createGame(source)
        })

        afterEach(async () => {
            vi.restoreAllMocks()
            for (const id of gameIds) await db.recursiveDelete(db.doc(`games/${id}`))
            live.cache.destroy()
            live.client.destroy()
            await db.terminate()
        })

        async function continueGame() {
            const game = await fixture.service.continueGame({
                definition,
                gameId: source.id,
                user: owner
            })
            gameIds.add(game.id)
            return game
        }

        it('creates one successor under concurrent requests and sends invitations only once', async () => {
            const games = await Promise.all([continueGame(), continueGame(), continueGame()])
            expect(new Set(games.map((game) => game.id)).size).toBe(1)
            expect(fixture.service.inviteUserToGame).toHaveBeenCalledTimes(2)
            const next = games[0]
            expect(next.players.map((player) => player.id)).toEqual(
                source.players.map((player) => player.id)
            )
            expect(next.players.map((player) => player.status)).toEqual([
                PlayerStatus.Joined,
                PlayerStatus.Reserved,
                PlayerStatus.Reserved
            ])
            expect(next.status).toBe(GameStatus.WaitingForPlayers)
            expect(next.config).toEqual(source.config)
            expect(next.state).toBeUndefined()
            expect((await fixture.store.findGameById(source.id, false))?.continuedToGameId).toBe(
                next.id
            )
            expect(await fixture.store.getContinuationState(next.id)).toEqual(source.state)
            expect(
                JSON.stringify(vi.mocked(fixture.notifications.sendNotification).mock.calls)
            ).not.toContain('hidden-one')
        })

        it('starts from the captured state after the source is changed and deleted', async () => {
            const next = await continueGame()
            const captured = await fixture.store.getContinuationState(next.id)
            expect(captured).toMatchObject({ board: [13, 71] })
            const changed = structuredClone(source.state!)
            changed.canContinue = false
            delete changed.result
            await fixture.store.setGameState({ gameId: source.id, state: changed })
            expect((await continueGame()).id).toBe(next.id)
            await fixture.store.deleteGame(source)
            for (const user of participants.slice(1))
                await fixture.service.joinGame({ gameId: next.id, user })
            const started = await fixture.service.startGame({
                definition,
                gameId: next.id,
                user: owner
            })
            expect(started.state).toMatchObject({
                board: [13, 71],
                actionCount: 0,
                actionChecksum: 0,
                winningPlayerIds: []
            })
            expect(started.state?.result).toBeUndefined()
            expect(started.state?.masterSeed).not.toBe(source.state?.masterSeed)
            expect(await fixture.store.findActionsForGame(started)).toEqual([])
        })

        it('keeps public continuation seats and configuration fixed through decline and rejoin', async () => {
            const next = await continueGame()
            const declined = await fixture.service.declineGame({
                gameId: next.id,
                user: participants[1]
            })
            expect(declined.players[1]).toMatchObject({
                userId: participants[1].id,
                status: PlayerStatus.Declined
            })
            await expect(
                fixture.service.joinGame({ gameId: next.id, user: { ...owner, id: 'stranger' } })
            ).rejects.toThrow('players are fixed')
            await expect(
                fixture.service.updateGame({
                    gameId: next.id,
                    owner,
                    fields: { config: { altered: true } }
                })
            ).rejects.toThrow('configuration is fixed')
            const joined = await fixture.service.joinGame({
                gameId: next.id,
                user: participants[1]
            })
            expect(joined.players[1].status).toBe(PlayerStatus.Joined)
        })

        it('retains the successor relationship after successor deletion', async () => {
            const next = await continueGame()
            await fixture.store.deleteGame(next)
            await expect(continueGame()).rejects.toThrow('continuation has been deleted')
            expect((await fixture.store.findGameById(source.id, false))?.continuedToGameId).toBe(
                next.id
            )
        })
    }
)
