import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'
import { ExternalAuthService } from '@tabletop/common'
import { authSession } from '../../../../lib/session.js'
import { verifyGoogleCredential } from '../../../../lib/googleCredential.js'

type LoginRequest = Static<typeof LoginRequest>
const LoginRequest = Type.Object({
    credential: Type.String()
})

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: LoginRequest }>(
        '/login',
        {
            config: { rateLimit: { max: 50, timeWindow: '1 minute' } },
            schema: { body: LoginRequest }
        },
        async function (request, _reply) {
            const payload = await verifyGoogleCredential(request.body.credential)
            const user = await fastify.userService.handleExternalAuth({
                service: ExternalAuthService.Google,
                externalId: payload.sub,
                email: payload.email,
                emailVerified: payload.email_verified
            })
            await authSession({
                session: request.session,
                user,
                proof: 'authentication-method',
                sessions: fastify.sessionService
            })
            return { status: 'ok', payload: { user } }
        }
    )
}
