import { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
    fastify.post(
        '/invalidate',
        {
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleAdmin], {
                relation: 'and'
            })
        },
        async function () {
            await fastify.libraryService.invalidateManifestCache()
            // Cloud Run gives an instance CPU only while a request is open, so the activation
            // the new manifest asks for runs inside this one and its outcome is reported.
            await fastify.libraryService.refreshAndActivate()
            return { status: 'ok', replacement: 'none', activation: 'complete' }
        }
    )
}
