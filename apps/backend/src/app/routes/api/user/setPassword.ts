import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'
import { InvalidChallengeError, parseSetPasswordChallenge } from '@tabletop/backend-services'

// Set Password is authorized by the emailed Set Password Challenge alone: the person holds no
// session, and completing it establishes none.
type SetPasswordRequest = Static<typeof SetPasswordRequest>
const SetPasswordRequest = Type.Object(
    {
        password: Type.String(),
        challenge: Type.String()
    },
    { additionalProperties: false }
)

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: SetPasswordRequest }>(
        '/setPassword',
        {
            config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
            schema: { body: SetPasswordRequest }
        },
        async function (request, _reply) {
            const presented = parseSetPasswordChallenge(request.body.challenge)
            if (!presented) {
                throw new InvalidChallengeError('format')
            }
            await fastify.userService.setPassword({ ...presented, password: request.body.password })
            // Every session died with the Session Generation; their realtime connections end too
            await fastify.realtimeControl.revokeAccount(presented.userId)
            return { status: 'ok', payload: {} }
        }
    )
}
