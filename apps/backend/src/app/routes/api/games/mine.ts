import { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
    fastify.get(
        `/mine`,
        {
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleUser], {
                relation: 'and'
            })
        },
        async function (request) {
            if (!request.user) {
                throw Error('No user found for create request')
            }

            const games = await fastify.gameService.getGamesForUser(request.user)

            return { status: 'ok', payload: { games } }
        }
    )
}
