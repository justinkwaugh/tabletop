import { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
    fastify.get('/logout', async function (request, _reply) {
        const sessionId = request.session.get('sessionId')
        if (sessionId) {
            await fastify.sessionService.revoke(sessionId)
        }
        request.session.delete()
        return { status: 'ok', payload: {} }
    })
}
