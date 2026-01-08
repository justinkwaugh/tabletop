import { assert } from '@tabletop/common'
import { FastifyInstance } from 'fastify'
import Type, { Static } from 'typebox'

type ParamsType = Static<typeof ParamsType>
const ParamsType = Type.Object({
    titleId: Type.String()
})

export default async function (fastify: FastifyInstance) {
    fastify.get<{ Params: ParamsType }>(
        `/open/:titleId`,
        {
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleUser], {
                relation: 'and'
            })
        },
        async function (request) {
            assert(request.user, 'No user found for create request')

            const games = await fastify.gameService.getOpenGamesForTitle(request.params.titleId)
            return { status: 'ok', payload: { games } }
        }
    )
}
