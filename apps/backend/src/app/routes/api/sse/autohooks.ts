import { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
    fastify.addHook('onRequest', async (_request, reply) => {
        if (!fastify.ssePubSub) {
            return reply.code(404).send()
        }
    })
}
