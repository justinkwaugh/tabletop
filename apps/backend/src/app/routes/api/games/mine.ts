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

            const results = await Promise.all([
                fastify.gameService.getActiveGamesForUser(request.user),
                fastify.gameService.getCompletedGamesForUser(request.user)
            ])
            const games = results[0].concat(results[1])

            return { status: 'ok', payload: { games } }
        }
    )
}
