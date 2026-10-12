import fp from 'fastify-plugin'

const REDIRECT_CACHE_CONTROL = 'public, max-age=86400'

const isEmptyOrDotSegment = (segment: string) =>
    segment === '' || segment === '.' || segment === '..'

export default fp(async (fastify) => {
    const assetBaseUrl = process.env['GAME_ASSET_BASE_URL']?.replace(/\/+$/, '')
    if (!assetBaseUrl) return

    fastify.get<{ Params: { gameId: string; version: string; '*': string } }>(
        '/games/:gameId/ui/:version/assets/*',
        async (request, reply) => {
            const { gameId, version } = request.params
            const segments = [
                'games',
                gameId,
                'ui',
                version,
                'assets',
                ...request.params['*'].split('/')
            ]
            if (segments.some(isEmptyOrDotSegment)) return reply.callNotFound()

            return reply
                .header('Cache-Control', REDIRECT_CACHE_CONTROL)
                .redirect(`${assetBaseUrl}/${segments.map(encodeURIComponent).join('/')}`, 302)
        }
    )
})
