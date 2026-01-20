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
            await fastify.libraryService.refreshManifest()
            return { status: 'ok' }
        }
    )
}
