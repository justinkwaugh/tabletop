import type { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
    fastify.get('/catalog', async function (_req, reply) {
        const manifest = await fastify.libraryService.getManifest()
        const payload = await fastify.catalogService.getCatalog(manifest)
        reply.header(
            'Cache-Control',
            payload.length === manifest.games.length ? 'public, max-age=60' : 'no-store'
        )
        return { status: 'ok', payload }
    })
}
