import fastifyAuth from '@fastify/auth'
import {
    GameStatus,
    GameStorage,
    PlayerStatus,
    Role,
    type Game,
    type GameDefinition,
    type User,
    UserStatus
} from '@tabletop/common'
import Fastify from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'
import startGameRoute from './start.js'
import continueGameRoute from './continue.js'

const user: User = {
    id: 'user-1',
    status: UserStatus.Active,
    roles: [Role.User],
    externalIds: []
}

const definition: GameDefinition = {
    info: {
        id: 'start-test',
        metadata: {
            name: 'Start Test',
            designer: 'Test',
            description: 'Tests starting a hosted game.',
            year: '2026',
            minPlayers: 1,
            maxPlayers: 1,
            defaultPlayerCount: 1,
            version: '1.0.0',
            beta: true
        }
    },
    runtime: {
        initializer: {
            initializeGame() {
                throw new Error('Unused by route test')
            },
            initializeGameState() {
                throw new Error('Unused by route test')
            }
        },
        hydrator: {
            hydrateAction() {
                throw new Error('Unused by route test')
            },
            hydrateState() {
                throw new Error('Unused by route test')
            }
        },
        playerColors: [],
        apiActions: {},
        stateHandlers: {}
    }
}

function createStartedGame(): Game {
    return {
        id: 'game-1',
        typeId: definition.info.id,
        status: GameStatus.Started,
        isPublic: false,
        deleted: false,
        ownerId: user.id,
        name: 'Started Game',
        players: [
            {
                id: 'player-1',
                userId: user.id,
                name: 'Player 1',
                isHuman: true,
                status: PlayerStatus.Joined
            }
        ],
        config: {},
        hotseat: false,
        state: {
            id: 'state-1',
            gameId: 'game-1',
            players: [],
            activePlayerIds: ['player-1'],
            actionCount: 0,
            actionChecksum: 0,
            prng: { seed: 17, invocations: 0 },
            machineState: 'playing',
            turnManager: { series: [], turnOrder: ['player-1'], turnCounts: {} },
            winningPlayerIds: []
        },
        createdAt: new Date('2026-09-03T00:00:00.000Z'),
        winningPlayerIds: [],
        seed: 17,
        storage: GameStorage.Remote
    }
}

async function createServer(operation: 'start' | 'continue') {
    const server = Fastify()
    await server.register(fastifyAuth)

    Reflect.set(server, 'verifyActiveUser', async (request: { user?: User }) => {
        request.user = user
    })
    Reflect.set(server, 'verifyRoleUser', async () => undefined)

    const startedGame = createStartedGame()
    const startGame = vi.fn(async () => startedGame)
    Reflect.set(server, 'gameService', {
        [operation === 'start' ? 'startGame' : 'continueGame']: startGame
    })

    await server.register(
        (operation === 'start' ? startGameRoute : continueGameRoute).bind(undefined, definition)
    )
    return { server, startGame, startedGame }
}

describe('game initialization routes', () => {
    const servers = new Set<ReturnType<typeof Fastify>>()

    afterEach(async () => {
        await Promise.all([...servers].map((server) => server.close()))
        servers.clear()
    })

    it.each(['start', 'continue'] as const)(
        'POST /%s omits canonical state from its response',
        async (operation) => {
            const { server, startGame, startedGame } = await createServer(operation)
            servers.add(server)

            const response = await server.inject({
                method: 'POST',
                url: `/${operation}`,
                payload: { gameId: startedGame.id }
            })

            expect(response.statusCode).toBe(200)
            expect(response.json().payload.game).not.toHaveProperty('state')
            expect(startedGame).toHaveProperty('state')
            expect(startGame).toHaveBeenCalledWith({
                definition,
                gameId: startedGame.id,
                user
            })
        }
    )
})
