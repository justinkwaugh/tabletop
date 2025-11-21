import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'
import { ExternalAuthService } from '@tabletop/common'
import { URLSearchParams } from 'url'
import {
    RESTGetAPIOAuth2CurrentAuthorizationResult,
    RESTPostOAuth2AccessTokenResult
} from 'discord-api-types/v10'

type LinkRequest = Static<typeof LinkRequest>
const LinkRequest = Type.Object({
    code: Type.String()
})

const API_ENDPOINT = 'https://discord.com/api'
const CLIENT_ID = process.env['DISCORD_CLIENT_ID'] || ''
const FRONTEND_HOST = process.env['FRONTEND_HOST'] || ''
const REDIRECT_URI = `${FRONTEND_HOST}/oauth/discord/link`

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: LinkRequest }>(
        '/link',
        {
            config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
            schema: { body: LinkRequest },
            onRequest: fastify.auth([fastify.verifyUser], { relation: 'and' })
        },
        async function (request, reply) {
            if (!request.user) {
                throw Error('No user found for link request')
            }

            const { code } = request.body
            const client_secret = await fastify.secretsService.getSecret('DISCORD_SECRET')

            const data = {
                client_id: CLIENT_ID,
                client_secret: client_secret,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: REDIRECT_URI
            }

            const tokenResponse = await fetch(`${API_ENDPOINT}/oauth2/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams(data)
            })

            const tokenData = (await tokenResponse.json()) as RESTPostOAuth2AccessTokenResult
            if (!tokenData) {
                console.log('No token data')
                await reply.code(401).send()
                return
            }
            const accessToken = tokenData.access_token
            const userInfoResponse = await fetch(`${API_ENDPOINT}/oauth2/@me`, {
                method: 'GET',
                headers: { Authorization: `Bearer ${accessToken}` }
            })

            const userInfoData =
                (await userInfoResponse.json()) as RESTGetAPIOAuth2CurrentAuthorizationResult
            if (!userInfoData || !userInfoData.user) {
                console.log('No userInfo data')
                await reply.code(401).send()
                return
            }

            const externalId = userInfoData.user.id

            const updatedUser = await fastify.userService.linkExternalAccount({
                userId: request.user.id,
                externalId,
                service: ExternalAuthService.Discord
            })
            return { status: 'ok', payload: { user: updatedUser } }
        }
    )
}
