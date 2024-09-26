import { type Static, Type } from '@sinclair/typebox'
import { FastifyInstance } from 'fastify'

type SearchQueryType = Static<typeof SearchQueryType>
const SearchQueryType = Type.Object(
    {
        query: Type.String()
    },
    { additionalProperties: false }
)

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: SearchQueryType }>(
        '/usernameSearch',
        {
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleUser], {
                relation: 'and'
            })
        },
        async function (request, _reply) {
            const user = request.user
            if (!user) {
                throw Error('No user found for search request')
            }

            const usernames = await fastify.userService.searchUsernames(request.body.query)

            return { status: 'ok', payload: { usernames } }
        }
    )
}
