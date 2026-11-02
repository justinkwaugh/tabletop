import { type Static, Type } from 'typebox'
import { DateType, sessionGenerationOf, type User } from '@tabletop/common'
import { ProviderAuthorizationAttempt } from '../oauth/providerAuthorization.js'

export type AuthenticatedSession = Static<typeof AuthenticatedSession>
export const AuthenticatedSession = Type.Object({
    id: Type.String(),
    userId: Type.String(),
    generation: Type.Integer({ minimum: 0 }),
    createdAt: DateType(),
    authenticatedAt: Type.Optional(DateType()),
    expiresAt: DateType(),
    providerAuthorization: Type.Optional(ProviderAuthorizationAttempt)
})

export type AuthenticationProof =
    'authentication-method' | Pick<AuthenticatedSession, 'authenticatedAt'>

export function isSessionLiveForAccount(
    session: AuthenticatedSession,
    account: Pick<User, 'sessionGeneration'>,
    now: Date
): boolean {
    return session.expiresAt > now && session.generation === sessionGenerationOf(account)
}
