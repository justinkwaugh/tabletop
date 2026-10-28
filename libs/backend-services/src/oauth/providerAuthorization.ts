import { customAlphabet } from 'nanoid'
import { type Static, Type } from 'typebox'
import { BaseError, DateType, ExternalAuthService } from '@tabletop/common'

export const OAUTH_STATE_LIFETIME_SECONDS = 10 * 60

const STATE_SEPARATOR = '.'
const NONCE_LENGTH = 32
const nonce = customAlphabet(
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
    NONCE_LENGTH
)

export type OAuthPurpose = Static<typeof OAuthPurpose>
export const OAuthPurpose = Type.Union([
    Type.Literal('login'),
    Type.Literal('link'),
    Type.Literal('reauthenticate')
])
export const OAUTH_PURPOSES: readonly OAuthPurpose[] = OAuthPurpose.anyOf.map(
    (literal) => literal.const
)

export type ProviderAuthorizationRequest = Static<typeof ProviderAuthorizationRequest>
export const ProviderAuthorizationRequest = Type.Object({
    provider: Type.Enum(ExternalAuthService),
    purpose: OAuthPurpose,
    redirectUri: Type.String()
})

export type ProviderAuthorizationAttempt = Static<typeof ProviderAuthorizationAttempt>
export const ProviderAuthorizationAttempt = Type.Evaluate(
    Type.Intersect([
        ProviderAuthorizationRequest,
        Type.Object({
            state: Type.String(),
            expiresAt: DateType()
        })
    ])
)

export class InvalidOAuthStateError extends BaseError {
    readonly statusCode = 400

    constructor(reason: 'missing' | 'state' | 'binding' | 'expired') {
        super({
            name: 'InvalidOAuthStateError',
            message: 'The provider authorization does not belong to this request',
            metadata: { reason }
        })
    }
}

export function issueProviderAuthorization(
    request: ProviderAuthorizationRequest,
    now: Date
): ProviderAuthorizationAttempt {
    return {
        ...request,
        state: `${request.purpose}${STATE_SEPARATOR}${nonce()}`,
        expiresAt: new Date(now.getTime() + OAUTH_STATE_LIFETIME_SECONDS * 1000)
    }
}

export function verifyProviderAuthorization(
    attempt: ProviderAuthorizationAttempt | undefined,
    state: string,
    expected: ProviderAuthorizationRequest,
    now: Date
): void {
    if (!attempt) {
        throw new InvalidOAuthStateError('missing')
    }
    if (attempt.state !== state) {
        throw new InvalidOAuthStateError('state')
    }
    if (
        attempt.provider !== expected.provider ||
        attempt.purpose !== expected.purpose ||
        attempt.redirectUri !== expected.redirectUri
    ) {
        throw new InvalidOAuthStateError('binding')
    }
    if (attempt.expiresAt <= now) {
        throw new InvalidOAuthStateError('expired')
    }
}
