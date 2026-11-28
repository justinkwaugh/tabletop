import { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
    const adminOnly = {
        onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleAdmin], {
            relation: 'and'
        })
    }

    fastify.get('/time-difference-notice', adminOnly, async function () {
        return { status: 'ok', payload: await fastify.timeDifferenceNotice.status() }
    })

    fastify.post('/time-difference-notice', adminOnly, async function () {
        return { status: 'ok', payload: await fastify.timeDifferenceNotice.queue() }
    })
}
