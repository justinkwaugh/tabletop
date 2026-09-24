import type { FastifyInstance } from 'fastify'
import { PreferenceChange, PreferenceError, type GameDefinition } from '@tabletop/common'

export default async function (definition: GameDefinition, fastify: FastifyInstance) {
    const preferences = definition.info.preferences
    if (!preferences) return
    const auth = {
        onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleUser], {
            relation: 'and' as const
        })
    }

    fastify.get('/preferences', auth, async (request, reply) => {
        if (!request.user) return reply.code(401).send()
        const match = request.headers['if-none-match']
        const result = await fastify.preferenceService.read(
            request.user.id,
            definition.info.id,
            preferences,
            typeof match === 'string' ? match : undefined
        )
        const vary = reply.getHeader('Vary')
        reply
            .header('ETag', result.etag)
            .header('Cache-Control', 'private, no-cache')
            .header('Vary', vary ? `${vary}, Cookie` : 'Cookie')
        if (!result.data) return reply.code(304).send()
        return { status: 'ok', payload: result.data }
    })

    fastify.post<{ Body: PreferenceChange }>(
        '/updateTitlePreferences',
        {
            ...auth,
            bodyLimit: 16384,
            schema: { body: PreferenceChange }
        },
        async (request, reply) => {
            if (!request.user) return reply.code(401).send()
            const match = request.headers['if-match']
            if (typeof match !== 'string')
                return reply.code(428).send({ message: 'If-Match is required' })
            try {
                const result = await fastify.preferenceService.update(
                    request.user.id,
                    definition.info.id,
                    preferences,
                    request.body,
                    match
                )
                reply.header('ETag', result.etag).header('Cache-Control', 'no-store')
                return { status: 'ok', payload: result.data }
            } catch (error) {
                if (error instanceof PreferenceError)
                    return reply.code(error.status).send({ message: error.message })
                throw error
            }
        }
    )
}
