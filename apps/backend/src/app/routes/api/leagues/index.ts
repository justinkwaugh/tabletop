import type { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'
import {
    assertExists,
    CreateLeagueRequest,
    LeagueParams,
    LeagueSeasonParams,
    LeagueSignUpCloseRequest,
    LeagueSignUpPolicy,
    type LeagueSignUpOperation,
    UpdateLeagueRequest
} from '@tabletop/common'
import {
    competitionRequestValidator,
    prepareCompetitionRoutes
} from '../../../lib/competitionRoutes.js'

const validateLeagueSettings = competitionRequestValidator('Invalid league request')

const EmptyBody = Type.Object({}, { additionalProperties: false })

export default async function (fastify: FastifyInstance) {
    prepareCompetitionRoutes(fastify, 'LeagueError')

    fastify.get('/', async (request) => {
        assertExists(request.user, 'Authenticated user required')
        return {
            status: 'ok',
            payload: { leagues: await fastify.leagueService.list(request.user) }
        }
    })
    fastify.post<{ Body: Static<typeof CreateLeagueRequest> }>(
        '/',
        {
            schema: { body: CreateLeagueRequest },
            validatorCompiler: validateLeagueSettings,
            preHandler: fastify.verifyRoleAdmin
        },
        async (request) => {
            assertExists(request.user, 'Authenticated administrator required')
            return {
                status: 'ok',
                payload: await fastify.leagueService.create(
                    request.body.id,
                    request.body.draft,
                    request.user
                )
            }
        }
    )
    fastify.post<{ Params: Static<typeof LeagueParams>; Body: Static<typeof UpdateLeagueRequest> }>(
        '/:id/update',
        {
            schema: { params: LeagueParams, body: UpdateLeagueRequest },
            validatorCompiler: validateLeagueSettings,
            preHandler: fastify.verifyRoleAdmin
        },
        async (request) => {
            assertExists(request.user, 'Authenticated administrator required')
            return {
                status: 'ok',
                payload: await fastify.leagueService.update(
                    request.params.id,
                    request.body.draft,
                    request.body.revision,
                    request.user
                )
            }
        }
    )
    fastify.post<{ Params: Static<typeof LeagueParams>; Body: Static<typeof LeagueSignUpPolicy> }>(
        '/:id/signUp/policy',
        {
            schema: { params: LeagueParams, body: LeagueSignUpPolicy },
            preHandler: fastify.verifyRoleAdmin
        },
        async (request) => {
            assertExists(request.user, 'Authenticated administrator required')
            return {
                status: 'ok',
                payload: await fastify.leagueService.updateSignUpPolicy(
                    request.params.id,
                    request.body,
                    request.user
                )
            }
        }
    )
    fastify.get<{ Params: Static<typeof LeagueParams> }>(
        '/:id',
        { schema: { params: LeagueParams } },
        async (request) => {
            assertExists(request.user, 'Authenticated user required')
            return {
                status: 'ok',
                payload: await fastify.leagueService.get(request.params.id, undefined, request.user)
            }
        }
    )
    fastify.get<{ Params: Static<typeof LeagueSeasonParams> }>(
        '/:id/seasons/:season',
        { schema: { params: LeagueSeasonParams } },
        async (request) => {
            assertExists(request.user, 'Authenticated user required')
            return {
                status: 'ok',
                payload: await fastify.leagueService.get(
                    request.params.id,
                    request.params.season,
                    request.user
                )
            }
        }
    )
    fastify.get<{ Params: Static<typeof LeagueParams> }>(
        '/:id/preview',
        { schema: { params: LeagueParams }, preHandler: fastify.verifyRoleAdmin },
        async (request) => {
            assertExists(request.user, 'Authenticated administrator required')
            return {
                status: 'ok',
                payload: {
                    groups:
                        (await fastify.leagueService.preview(request.params.id, request.user)) ??
                        null
                }
            }
        }
    )
    const closeOperations: Record<
        LeagueSignUpOperation,
        'publish' | 'openNextSeason' | 'setSignUpClose'
    > = {
        publish: 'publish',
        'seasons/next': 'openNextSeason',
        'signUp/close': 'setSignUpClose'
    }
    for (const [path, operation] of Object.entries(closeOperations)) {
        fastify.post<{
            Params: Static<typeof LeagueParams>
            Body: Static<typeof LeagueSignUpCloseRequest>
        }>(
            `/:id/${path}`,
            {
                schema: { params: LeagueParams, body: LeagueSignUpCloseRequest },
                preHandler: fastify.verifyRoleAdmin
            },
            async (request) => {
                assertExists(request.user, 'Authenticated administrator required')
                return {
                    status: 'ok',
                    payload: await fastify.leagueService[operation](
                        request.params.id,
                        request.body.closesAt,
                        request.user
                    )
                }
            }
        )
    }
    fastify.post<{ Params: Static<typeof LeagueParams>; Body: Static<typeof EmptyBody> }>(
        '/:id/seasons/cancel',
        {
            schema: { params: LeagueParams, body: EmptyBody },
            preHandler: fastify.verifyRoleAdmin
        },
        async (request) => {
            assertExists(request.user, 'Authenticated administrator required')
            return {
                status: 'ok',
                payload: await fastify.leagueService.cancelSeason(request.params.id, request.user)
            }
        }
    )
    for (const operation of ['signUp', 'withdraw'] as const) {
        fastify.post<{ Params: Static<typeof LeagueParams>; Body: Static<typeof EmptyBody> }>(
            `/:id/${operation}`,
            { schema: { params: LeagueParams, body: EmptyBody } },
            async (request) => {
                assertExists(request.user, 'Authenticated user required')
                return {
                    status: 'ok',
                    payload: await fastify.leagueService[operation](request.params.id, request.user)
                }
            }
        )
    }
}
