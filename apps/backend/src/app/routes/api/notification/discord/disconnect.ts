import { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
    fastify.post(
        '/disconnect',
        {
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleUser], {
                relation: 'and'
            })
        },
        async function (request) {
            if (!request.user) {
                throw Error('No user found for Discord bot disconnect request')
            }

            await fastify.discordService.disconnect(request.user.id)
            return { status: 'ok', payload: {} }
        }
    )
}
