import { type Static, Type } from 'typebox'
import { BaseError, DateType, ExternalAuthService } from '@tabletop/common'

export const OAUTH_STATE_LIFETIME_SECONDS = 10 * 60

export type OAuthPurpose = Static<typeof OAuthPurpose>
export const OAuthPurpose = Type.Union([
    Type.Literal('login'),
    Type.Literal('link'),
    Type.Literal('reauthenticate')
])
export const OAUTH_PURPOSES: readonly OAuthPurpose[] = OAuthPurpose.anyOf.map(
    (literal) => literal.const
)

export function isOAuthPurpose(value: string): value is OAuthPurpose {
    return OAUTH_PURPOSES.some((purpose) => purpose === value)
}

export type OAuthStateBinding = Static<typeof OAuthStateBinding>
export const OAuthStateBinding = Type.Union([
    Type.Object({ kind: Type.Literal('attempt'), attemptId: Type.String() }),
    Type.Object({ kind: Type.Literal('session'), sessionId: Type.String(), userId: Type.String() })
])

export type OAuthStateClaim = Static<typeof OAuthStateClaim>
export const OAuthStateClaim = Type.Object({
    provider: Type.Enum(ExternalAuthService),
    purpose: OAuthPurpose,
    redirectUri: Type.String(),
    binding: OAuthStateBinding
})

export type OAuthStateRecord = Static<typeof OAuthStateRecord>
export const OAuthStateRecord = Type.Evaluate(
    Type.Intersect([
        OAuthStateClaim,
        Type.Object({
            state: Type.String(),
            expiresAt: DateType()
        })
    ])
)

export class InvalidOAuthStateError extends BaseError {
    readonly statusCode = 400

    constructor(reason: string) {
        super({
            name: 'InvalidOAuthStateError',
            message: 'The provider authorization does not belong to this request',
            metadata: { reason }
        })
    }
}
