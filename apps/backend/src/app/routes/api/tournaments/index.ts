import type { FastifyInstance } from 'fastify'
import { type Static } from 'typebox'
import {
    assertExists,
    CreateTournamentRequest,
    UpdateTournamentRequest,
    JoinTournamentRequest,
    TournamentListQuery,
    TournamentScheduleRequest,
    CommitTournamentScheduleRequest,
    TournamentParams
} from '@tabletop/common'
import { TournamentError } from '@tabletop/backend-services'

export default async function (fastify: FastifyInstance) {
    fastify.addHook('onRequest', fastify.verifyActiveUser)
    fastify.addHook('onSend', async (_request, reply, payload) => {
        reply.header('Cache-Control', 'no-store')
        return payload
    })
    fastify.setErrorHandler((error, _request, reply) => {
        if (error instanceof TournamentError)
            return reply.code(error.statusCode).send({
                status: 'error',
                error: { name: 'TournamentError', message: error.message }
            })
        return reply.send(error)
    })

    fastify.get<{ Querystring: Static<typeof TournamentListQuery> }>(
        '/',
        { schema: { querystring: TournamentListQuery } },
        async (request) => {
            assertExists(request.user, 'Authenticated user required')
            return {
                status: 'ok',
                payload: await fastify.tournamentService.list(request.user, request.query)
            }
        }
    )
    fastify.post<{ Body: Static<typeof CreateTournamentRequest> }>(
        '/',
        { schema: { body: CreateTournamentRequest }, preHandler: fastify.verifyRoleAdmin },
        async (request) => {
            assertExists(request.user, 'Authenticated administrator required')
            return {
                status: 'ok',
                payload: await fastify.tournamentService.create(
                    request.body.id,
                    request.body.draft,
                    request.user
                )
            }
        }
    )
    fastify.get<{ Params: Static<typeof TournamentParams> }>(
        '/:id',
        { schema: { params: TournamentParams } },
        async (request) => {
            assertExists(request.user, 'Authenticated user required')
            return {
                status: 'ok',
                payload: await fastify.tournamentService.get(request.params.id, request.user)
            }
        }
    )
    fastify.get<{ Params: Static<typeof TournamentParams> }>(
        '/:id/schedule',
        { schema: { params: TournamentParams } },
        async (request) => {
            assertExists(request.user, 'Authenticated user required')
            return {
                status: 'ok',
                payload: await fastify.tournamentService.getSchedule(
                    request.params.id,
                    request.user
                )
            }
        }
    )
    fastify.post<{
        Params: Static<typeof TournamentParams>
        Body: Static<typeof TournamentScheduleRequest>
    }>(
        '/:id/schedule/preview',
        {
            schema: { params: TournamentParams, body: TournamentScheduleRequest },
            preHandler: fastify.verifyRoleAdmin
        },
        async (request) => {
            assertExists(request.user, 'Authenticated administrator required')
            return {
                status: 'ok',
                payload: await fastify.tournamentService.previewSchedule(
                    request.params.id,
                    request.body,
                    request.user
                )
            }
        }
    )
    fastify.post<{
        Params: Static<typeof TournamentParams>
        Body: Static<typeof CommitTournamentScheduleRequest>
    }>(
        '/:id/schedule',
        {
            schema: { params: TournamentParams, body: CommitTournamentScheduleRequest },
            preHandler: fastify.verifyRoleAdmin
        },
        async (request) => {
            assertExists(request.user, 'Authenticated administrator required')
            return {
                status: 'ok',
                payload: await fastify.tournamentService.commitSchedule(
                    request.params.id,
                    request.body,
                    request.user
                )
            }
        }
    )
    fastify.put<{
        Params: Static<typeof TournamentParams>
        Body: Static<typeof UpdateTournamentRequest>
    }>(
        '/:id',
        {
            schema: { params: TournamentParams, body: UpdateTournamentRequest },
            preHandler: fastify.verifyRoleAdmin
        },
        async (request) => {
            assertExists(request.user, 'Authenticated administrator required')
            return {
                status: 'ok',
                payload: await fastify.tournamentService.update(
                    request.params.id,
                    request.body.draft,
                    request.body.revision,
                    request.user
                )
            }
        }
    )
    for (const operation of ['pause', 'resume', 'retry'] as const) {
        fastify.post<{ Params: Static<typeof TournamentParams> }>(
            `/:id/${operation}`,
            { schema: { params: TournamentParams }, preHandler: fastify.verifyRoleAdmin },
            async (request) => {
                assertExists(request.user, 'Authenticated administrator required')
                return {
                    status: 'ok',
                    payload: await fastify.tournamentService.control(
                        request.params.id,
                        operation,
                        request.user
                    )
                }
            }
        )
    }
    for (const operation of ['publish', 'cancel', 'lock'] as const) {
        fastify.post<{ Params: Static<typeof TournamentParams> }>(
            `/:id/${operation}`,
            { schema: { params: TournamentParams }, preHandler: fastify.verifyRoleAdmin },
            async (request) => {
                assertExists(request.user, 'Authenticated administrator required')
                return {
                    status: 'ok',
                    payload: await fastify.tournamentService[operation](
                        request.params.id,
                        request.user
                    )
                }
            }
        )
    }
    fastify.post<{
        Params: Static<typeof TournamentParams>
        Body: Static<typeof JoinTournamentRequest>
    }>(
        '/:id/join',
        { schema: { params: TournamentParams, body: JoinTournamentRequest } },
        async (request) => {
            assertExists(request.user, 'Authenticated user required')
            return {
                status: 'ok',
                payload: await fastify.tournamentService.join(request.params.id, request.user)
            }
        }
    )
    fastify.post<{ Params: Static<typeof TournamentParams> }>(
        '/:id/leave',
        { schema: { params: TournamentParams } },
        async (request) => {
            assertExists(request.user, 'Authenticated user required')
            return {
                status: 'ok',
                payload: await fastify.tournamentService.leave(request.params.id, request.user)
            }
        }
    )
}
