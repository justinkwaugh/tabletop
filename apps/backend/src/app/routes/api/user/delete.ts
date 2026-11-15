import { FastifyInstance } from 'fastify'
import { assertExists } from '@tabletop/common'

export default async function (fastify: FastifyInstance) {
    fastify.post(
        '/delete',
        { onRequest: fastify.auth([fastify.verifyUser], { relation: 'and' }) },
        async function (request) {
            const session = request.authenticatedSession
            assertExists(session, 'Deleting an account requires an authorized session')
            await fastify.accountModeration.deleteOwnAccount(session)
            request.session.delete()
            request.log.info({ userId: session.userId }, 'Account deleted by its owner')
            return { status: 'ok', payload: {} }
        }
    )
}
