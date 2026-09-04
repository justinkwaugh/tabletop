import fastifyAuth from '@fastify/auth'
import {
    ActionSource,
    GameAction,
    type GameDefinition,
    Role,
    type User,
    UserStatus,
    Visibility
} from '@tabletop/common'
import Fastify from 'fastify'
import { Type } from 'typebox'
import { afterEach, describe, expect, it, vi } from 'vitest'
import applyActionRoute from './action.js'

const user: User = {
    id: 'user-1',
    status: UserStatus.Active,
    roles: [Role.User],
    externalIds: []
}

const definition: GameDefinition = {
    info: {
        id: 'action-test',
        metadata: {
            name: 'Action Test',
            designer: 'Test',
            description: 'Tests applying an Action to a hosted Game.',
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
            },
            initializeExplorationState(state) {
                return state
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

const TestAction = Type.Omit(GameAction, ['undoPatch', 'forwardPatch'])

async function createServer() {
    const server = Fastify()
    await server.register(fastifyAuth)

    Reflect.set(server, 'verifyActiveUser', async (request: { user?: User }) => {
        request.user = user
    })
    Reflect.set(server, 'verifyRoleUser', async () => undefined)

    const perspective: Visibility.Perspective = {
        kind: 'player',
        playerId: 'player-1'
    }
    const representation = {
        game: { id: 'game-1' },
        actions: [
            {
                id: 'action-1',
                gameId: 'game-1',
                source: ActionSource.User,
                type: 'test-action',
                index: 0
            }
        ],
        missingActions: [
            {
                id: 'missing-action',
                gameId: 'game-1',
                source: ActionSource.User,
                type: 'earlier-action',
                index: 0
            }
        ],
        perspective
    }
    const applyActionToGame = vi.fn(async () => representation)
    Reflect.set(server, 'gameService', { applyActionToGame })

    await server.register(applyActionRoute.bind(undefined, definition, 'test-action', TestAction))
    return { applyActionToGame, representation, server }
}

describe('POST /action/:actionType', () => {
    const servers = new Set<ReturnType<typeof Fastify>>()

    afterEach(async () => {
        await Promise.all([...servers].map((server) => server.close()))
        servers.clear()
    })

    it('returns the complete Action results representation as its payload', async () => {
        const { applyActionToGame, representation, server } = await createServer()
        servers.add(server)

        const response = await server.inject({
            method: 'POST',
            url: '/action/test-action',
            payload: {
                action: {
                    id: 'action-1',
                    gameId: 'game-1',
                    source: ActionSource.System,
                    type: 'test-action'
                }
            }
        })

        expect(response.statusCode).toBe(200)
        expect(response.json()).toEqual({
            status: 'ok',
            payload: representation
        })
        expect(applyActionToGame).toHaveBeenCalledWith({
            definition,
            action: expect.objectContaining({
                id: 'action-1',
                source: ActionSource.User,
                type: 'test-action'
            }),
            user
        })
    })
})
