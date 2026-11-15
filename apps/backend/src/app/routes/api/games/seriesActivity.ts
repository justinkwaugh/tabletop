import { assertExists } from '@tabletop/common'
import { FastifyInstance } from 'fastify'
import Type, { Static } from 'typebox'

type ParamsType = Static<typeof ParamsType>
const ParamsType = Type.Object({
    seriesId: Type.String()
})

export default async function (fastify: FastifyInstance) {
    fastify.get<{ Params: ParamsType }>(
        `/series-activity/:seriesId`,
        {
            schema: { params: ParamsType },
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleUser], {
                relation: 'and'
            })
        },
        async function (request, reply) {
            assertExists(request.user)
            const { seriesId } = request.params
            const titleIds = fastify.gameService.getSeriesTitleIds(seriesId, request.user.roles)
            if (titleIds.length === 0) return reply.code(404).send()
            const activity = await fastify.gameService.getSeriesActivity(seriesId, titleIds)
            return { status: 'ok', payload: { activity } }
        }
    )
}
