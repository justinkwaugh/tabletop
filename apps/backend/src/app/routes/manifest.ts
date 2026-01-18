import { FastifyInstance } from 'fastify'
import type { SiteManifest } from '@tabletop/games-config'

const frontendVersionOverride = process.env['FRONTEND_VERSION'] ?? null

const getBackendMetadata = () => ({
    buildSha: process.env['GIT_SHA'] ?? process.env['COMMIT_SHA'] ?? null,
    buildTime: process.env['BUILD_TIME'] ?? process.env['BUILD_TIMESTAMP'] ?? null,
    revision: process.env['K_REVISION'] ?? null
})

export default async function (fastify: FastifyInstance) {
    fastify.get('/manifest', async function (_req, reply) {
        let manifest: SiteManifest

        try {
            manifest = await fastify.libraryService.getManifest()
        } catch (error) {
            console.warn('Manifest unavailable', error)
            return reply.code(503).send({ status: 'error', message: 'Manifest unavailable' })
        }

        const frontend = frontendVersionOverride
            ? { ...manifest.frontend, version: frontendVersionOverride }
            : manifest.frontend

        reply.header('Cache-Control', 'no-store')
        return {
            ...manifest,
            frontend,
            backend: getBackendMetadata()
        }
    })
}
