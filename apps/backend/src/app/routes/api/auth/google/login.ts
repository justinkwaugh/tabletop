import { FastifyInstance } from 'fastify'
import { OAuth2Client } from 'google-auth-library'
import { Type, type Static } from '@sinclair/typebox'
import { ExternalAuthService } from '@tabletop/common'
import { authSession } from '../../../../lib/session.js'

type LoginRequest = Static<typeof LoginRequest>
const LoginRequest = Type.Object({
    credential: Type.String()
})

const GOOGLE_CLIENT_ID = process.env['GOOGLE_CLIENT_ID'] || ''

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: LoginRequest }>(
        '/login',
        {
            schema: { body: LoginRequest }
        },
        async function (request, _reply) {
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
            const email = payload.email
            const emailVerified = payload.email_verified

            const user = await fastify.userService.handleExternalAuth({
                service: ExternalAuthService.Google,
                externalId,
                email,
                emailVerified
            })
            authSession({ session: request.session, userId: user.id })
            return { status: 'ok', payload: { user } }
        }
    )
}
