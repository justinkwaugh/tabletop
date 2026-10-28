import { type Static, Type } from 'typebox'
import { DateType } from '@tabletop/common'

export type AuthenticatedSession = Static<typeof AuthenticatedSession>
export const AuthenticatedSession = Type.Object({
    id: Type.String(),
    userId: Type.String(),
    generation: Type.Integer({ minimum: 0 }),
    createdAt: DateType(),
    authenticatedAt: DateType(),
    expiresAt: DateType()
})
