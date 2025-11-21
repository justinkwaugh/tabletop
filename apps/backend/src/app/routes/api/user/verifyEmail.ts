import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'

type ParamsType = Static<typeof ParamsType>
const ParamsType = Type.Object({
    token: Type.String()
})

export default async function (fastify: FastifyInstance) {
    fastify.get<{ Params: ParamsType }>('/email/verify/:token', async function (request, _reply) {
        const { token } = request.params
        const updatedUser = await fastify.userService.verifyEmail(token)
        return { status: 'ok', payload: { user: updatedUser } }
    })
}
