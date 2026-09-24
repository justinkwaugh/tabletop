import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'

type UserSearchQuery = Static<typeof UserSearchQuery>
const UserSearchQuery = Type.Object({ query: Type.String() }, { additionalProperties: false })

export default async function (fastify: FastifyInstance) {
    fastify.get<{ Querystring: UserSearchQuery }>(
        '/search',
        {
            schema: { querystring: UserSearchQuery },
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleAdmin], {
                relation: 'and'
            })
        },
        async function (request) {
            const users = await fastify.userService.searchUsers(request.query.query)
            return { status: 'ok', payload: { users } }
        }
    )
}
