import { FastifyInstance } from 'fastify'
import { Type, type Static } from 'typebox'
import { ADMIN_ASSIGNABLE_ROLES } from '@tabletop/common'

type AssignRolesParams = Static<typeof AssignRolesParams>
const AssignRolesParams = Type.Object({ userId: Type.String() }, { additionalProperties: false })

type AssignRolesRequest = Static<typeof AssignRolesRequest>
const AssignRolesRequest = Type.Object(
    { roles: Type.Array(Type.Union(ADMIN_ASSIGNABLE_ROLES.map((role) => Type.Literal(role)))) },
    { additionalProperties: false }
)

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Params: AssignRolesParams; Body: AssignRolesRequest }>(
        '/:userId/roles',
        {
            schema: { params: AssignRolesParams, body: AssignRolesRequest },
            onRequest: fastify.auth([fastify.verifyActiveUser, fastify.verifyRoleAdmin], {
                relation: 'and'
            })
        },
        async function (request) {
            const user = await fastify.userService.assignRoles(
                request.params.userId,
                request.body.roles
            )
            return { status: 'ok', payload: { user } }
        }
    )
}
