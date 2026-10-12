import fp from 'fastify-plugin'

const REDIRECT_CACHE_CONTROL = 'public, max-age=86400'

export default fp<{ assetBaseUrl?: string }>(async (fastify, options) => {
    const assetBaseUrl = options.assetBaseUrl ?? process.env['GAME_ASSET_BASE_URL']
    if (!assetBaseUrl) return

    fastify.get('/games/:gameId/ui/:version/assets/*', async (request, reply) => {
        const assetPath = request.url.split('?')[0]
        return reply
            .header('Cache-Control', REDIRECT_CACHE_CONTROL)
            .redirect(`${assetBaseUrl}${assetPath}`, 302)
    })
})
