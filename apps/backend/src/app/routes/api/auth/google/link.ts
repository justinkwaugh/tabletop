import { FastifyInstance } from 'fastify'
import { OAuth2Client } from 'google-auth-library'
import { Type, type Static } from 'typebox'
import { ExternalAuthService } from '@tabletop/common'

type LoginRequest = Static<typeof LoginRequest>
const LoginRequest = Type.Object({
    credential: Type.String()
})

const GOOGLE_CLIENT_ID = process.env['GOOGLE_CLIENT_ID'] || ''

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: LoginRequest }>(
        '/link',
        {
            config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
            schema: { body: LoginRequest },
            onRequest: fastify.auth([fastify.verifyUser], { relation: 'and' })
        },
        async function (request, _reply) {
            if (!request.user) {
                throw Error('No user found for create request')
            }

            const client = new OAuth2Client()
            async function verify() {
                const ticket = await client.verifyIdToken({
                    idToken: request.body.credential,
                    audience: GOOGLE_CLIENT_ID
                })
                const payload = ticket.getPayload()
                return payload
            }

            const payload = await verify()
            if (!payload) {
                throw Error('Invalid token')
            }

            const externalId = payload.sub
            const updatedUser = await fastify.userService.linkExternalAccount({
                userId: request.user.id,
                externalId,
                service: ExternalAuthService.Google
            })
            return { status: 'ok', payload: { user: updatedUser } }
        }
    )
}
