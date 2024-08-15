import { FastifyInstance } from 'fastify'
import { Type, type Static } from '@sinclair/typebox'
import { ExternalAuthService } from '@tabletop/common'
import { authSession } from '../../../../lib/session.js'
import { URLSearchParams } from 'url'
import {
    RESTGetAPIOAuth2CurrentAuthorizationResult,
    RESTPostOAuth2AccessTokenResult
} from 'discord-api-types/v10'

type LoginRequest = Static<typeof LoginRequest>
const LoginRequest = Type.Object({
    code: Type.String()
})

const API_ENDPOINT = 'https://discord.com/api'
const CLIENT_ID = process.env['DISCORD_CLIENT_ID'] || ''
const FRONTEND_HOST = process.env['FRONTEND_HOST'] || ''
const REDIRECT_URI = `${FRONTEND_HOST}/oauth/discord`

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: LoginRequest }>(
        '/login',
        {
            schema: { body: LoginRequest }
        },
        async function (request, reply) {
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

            console.log('User Info: ', JSON.stringify(userInfoData))
            const externalId = userInfoData.user.id
            const email = userInfoData.user.email ? userInfoData.user.email : undefined
            const emailVerified = userInfoData.user.verified

            const user = await fastify.userService.handleExternalAuth({
                service: ExternalAuthService.Discord,
                externalId,
                email,
                emailVerified
            })
            authSession({ session: request.session, userId: user.id })
            return { status: 'ok', payload: { user } }
        }
    )
}
