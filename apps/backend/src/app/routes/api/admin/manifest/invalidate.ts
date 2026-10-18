import { FastifyInstance } from 'fastify'
import type { AppOptions } from '../../../../app.js'

export default async function (fastify: FastifyInstance, opts: AppOptions) {
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
            // Held open until a replacement the new manifest asked for ends; see ReplacementRequest.
            return { status: 'ok', replacement: await opts.replacement.outcome() }
        }
    )
}
