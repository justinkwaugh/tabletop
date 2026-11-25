import { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
    fastify.get(
        '/followed',
        {
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleUser], {
                relation: 'and'
            })
        },
        async function (request) {
            if (!request.user) {
                throw Error('No user found for followed games request')
            }
            return {
                status: 'ok',
                payload: { games: await fastify.gameFollowService.getFollowedGames(request.user) }
            }
        }
    )
}
