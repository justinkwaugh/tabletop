import { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
    fastify.get(
        `/hasActive`,
        {
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleUser], {
                relation: 'and'
            })
        },
        async function (request) {
            if (!request.user) {
                throw Error('No user found for create request')
            }

            const hasActive = await fastify.gameService.userHasCachedActiveGames(request.user)
            return { status: 'ok', payload: { hasActive } }
        }
    )
}
