import fastifyAuth from '@fastify/auth'
import { ActionSource, GameAction, Role, type User, UserStatus, Visibility } from '@tabletop/common'
import Fastify from 'fastify'
import { Type, type TSchema } from 'typebox'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { errorStatusCode } from '../../lib/errorStatusCode.js'
import applyActionRoute from './action.js'
import { routeTestDefinition } from './tests/routeTestDefinition.js'

const user: User = {
    id: 'user-1',
    status: UserStatus.Active,
    roles: [Role.User],
    externalIds: []
}

const definition = routeTestDefinition('action-test', 'Tests applying an Action to a hosted Game.')

const TestAction = Type.Omit(GameAction, ['undoPatch', 'forwardPatch'])

// A choice whose first variant is closed, like a standing instruction's pass-or-buy
const ChoiceAction = Type.Object(
    {
        ...TestAction.properties,
        choice: Type.Union([
            Type.Object({ kind: Type.Literal('pass') }, { additionalProperties: false }),
            Type.Object(
                { kind: Type.Literal('buy'), companyId: Type.String() },
                { additionalProperties: false }
            )
        ])
    },
    { additionalProperties: false }
)

// A rule AJV cannot see, so only the route's own check enforces it
const EvenAction = Type.Object(
    {
        ...TestAction.properties,
        count: Type.Refine(Type.Integer(), (count) => count % 2 === 0, 'count must be even')
    },
    { additionalProperties: false }
)

async function createServer(actionSchema: TSchema = TestAction) {
    const server = Fastify()
    server.setErrorHandler((error, _request, reply) =>
        reply.code(errorStatusCode(error)).send({ message: error.message })
    )
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

    await server.register(applyActionRoute.bind(undefined, definition, 'test-action', actionSchema))
    return { applyActionToGame, representation, server }
}

function postAction(
    server: ReturnType<typeof Fastify>,
    fields: Record<string, unknown> = {},
    body: Record<string, unknown> = { gameId: 'game-1' }
) {
    return server.inject({
        method: 'POST',
        url: '/action/test-action',
        payload: {
            ...body,
            action: {
                id: 'action-1',
                gameId: 'game-1',
                source: ActionSource.User,
                type: 'test-action',
                ...fields
            }
        }
    })
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

        const response = await postAction(server, { source: ActionSource.System })

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

    it('keeps every field of a later variant in a union', async () => {
        const { applyActionToGame, server } = await createServer(ChoiceAction)
        servers.add(server)
        const choice = { kind: 'buy', companyId: 'C' }

        const response = await postAction(server, { choice })

        expect(response.statusCode).toBe(200)
        expect(applyActionToGame).toHaveBeenCalledWith(
            expect.objectContaining({ action: expect.objectContaining({ choice }) })
        )
    })

    it.each([
        [
            'an unknown field at the top of the Action',
            { unknown: true, choice: { kind: 'pass' } },
            'body/action must NOT have additional properties'
        ],
        [
            'an unknown field inside a union variant',
            { choice: { kind: 'pass', unknown: true } },
            'body/action/choice must NOT have additional properties'
        ],
        [
            'a choice that matches no variant',
            { choice: { kind: 'buy' } },
            "body/action/choice must have required property 'companyId'"
        ]
    ])('rejects %s', async (_case, fields, message) => {
        const { applyActionToGame, server } = await createServer(ChoiceAction)
        servers.add(server)

        const response = await postAction(server, fields)

        expect(response.statusCode).toBe(400)
        expect(response.json().message).toContain(message)
        expect(applyActionToGame).not.toHaveBeenCalled()
    })

    it('rejects a request without the game id', async () => {
        const { applyActionToGame, server } = await createServer()
        servers.add(server)

        const response = await postAction(server, {}, {})

        expect(response.statusCode).toBe(400)
        expect(response.json().message).toContain("body must have required property 'gameId'")
        expect(applyActionToGame).not.toHaveBeenCalled()
    })

    it('rejects an Action for a different game', async () => {
        const { applyActionToGame, server } = await createServer()
        servers.add(server)

        const response = await postAction(server, {}, { gameId: 'game-2' })

        expect(response.statusCode).toBe(400)
        expect(response.json().message).toBe(
            'Invalid test-action action: the Action is for a different game'
        )
        expect(applyActionToGame).not.toHaveBeenCalled()
    })

    it('rejects an Action that passes AJV but fails its own schema', async () => {
        const { applyActionToGame, server } = await createServer(EvenAction)
        servers.add(server)

        const response = await postAction(server, { count: 3 })

        expect(response.statusCode).toBe(400)
        expect(response.json().message).toBe(
            'Invalid test-action action: /count count must be even'
        )
        expect(applyActionToGame).not.toHaveBeenCalled()
    })
})
