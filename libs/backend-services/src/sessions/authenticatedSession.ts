import { type Static, Type } from 'typebox'
import { DateType } from '@tabletop/common'

export type AuthenticatedSession = Static<typeof AuthenticatedSession>
export const AuthenticatedSession = Type.Object({
    id: Type.String(),
    userId: Type.String(),
    generation: Type.Integer({ minimum: 0 }),
    createdAt: DateType(),
    authenticatedAt: Type.Optional(DateType()),
    adminModeExpiresAt: Type.Optional(DateType()),
    expiresAt: DateType()
})

export type AuthenticationProof = 'authentication-method' | 'challenge'
