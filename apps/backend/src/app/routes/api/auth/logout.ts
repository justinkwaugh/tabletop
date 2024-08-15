import { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
    fastify.get('/logout', async function (request, _reply) {
        request.session.delete()
        return { status: 'ok', payload: {} }
    })
}
