import { assertExists } from '@tabletop/common'
import { FastifyInstance } from 'fastify'
import Type, { Static } from 'typebox'

type ParamsType = Static<typeof ParamsType>
const ParamsType = Type.Object({
    titleId: Type.String()
})

export default async function (fastify: FastifyInstance) {
    fastify.get<{ Params: ParamsType }>(
        `/activity/:titleId`,
        {
            schema: { params: ParamsType },
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleUser], {
                relation: 'and'
            })
        },
        async function (request, reply) {
            assertExists(request.user)
            const { titleId } = request.params
            if (!fastify.gameService.getTitle(titleId)) return reply.code(404).send()
            const activity = await fastify.gameService.getTitleActivity(titleId)
            return { status: 'ok', payload: { activity } }
        }
    )
}
