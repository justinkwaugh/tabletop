import { type Static, Type } from 'typebox'
import { BaseError, DateType, SensitiveChangeOperation } from '@tabletop/common'

export type AuthenticationChallengePurpose = Static<typeof AuthenticationChallengePurpose>
export const AuthenticationChallengePurpose = Type.Union([
    Type.Literal('set-password'),
    Type.Literal('email-verification'),
    Type.Literal('sensitive-change')
])

export type SetPasswordClaim = Static<typeof SetPasswordClaim>
export const SetPasswordClaim = Type.Object({
    purpose: Type.Literal('set-password'),
    userId: Type.String(),
    email: Type.String()
})

export type EmailVerificationClaim = Static<typeof EmailVerificationClaim>
export const EmailVerificationClaim = Type.Object({
    purpose: Type.Literal('email-verification'),
    userId: Type.String(),
    email: Type.String()
})

export type SensitiveChangeClaim = Static<typeof SensitiveChangeClaim>
export const SensitiveChangeClaim = Type.Object({
    purpose: Type.Literal('sensitive-change'),
    userId: Type.String(),
    email: Type.String(),
    operation: SensitiveChangeOperation
})

export type AuthenticationChallengeClaim = Static<typeof AuthenticationChallengeClaim>
export const AuthenticationChallengeClaim = Type.Union([
    SetPasswordClaim,
    EmailVerificationClaim,
    SensitiveChangeClaim
])

export type AuthenticationChallengeRecord = Static<typeof AuthenticationChallengeRecord>
export const AuthenticationChallengeRecord = Type.Evaluate(
    Type.Intersect([
        AuthenticationChallengeClaim,
        Type.Object({
            secretHash: Type.String(),
            expiresAt: DateType()
        })
    ])
)

export type IssuedChallenge = {
    secret: string
    expiresAt: Date
}

// A link challenge is typed by nobody; a code challenge is read from an email and typed by hand.
export const CHALLENGE_SECRET_LENGTH: Record<AuthenticationChallengePurpose, number> = {
    'set-password': 32,
    'email-verification': 6,
    'sensitive-change': 6
}

const KEY_SEPARATOR = ':'
const PRESENTATION_SEPARATOR = '.'

export function authenticationChallengeKey(
    claim: Pick<AuthenticationChallengeClaim, 'purpose' | 'userId'>
): string {
    return `${claim.purpose}${KEY_SEPARATOR}${claim.userId}`
}

export type PresentedSetPasswordChallenge = { userId: string; secret: string }

export function formatSetPasswordChallenge({
    userId,
    secret
}: PresentedSetPasswordChallenge): string {
    return `${userId}${PRESENTATION_SEPARATOR}${secret}`
}

export function parseSetPasswordChallenge(
    presented: string
): PresentedSetPasswordChallenge | undefined {
    const separator = presented.indexOf(PRESENTATION_SEPARATOR)
    if (separator <= 0 || separator === presented.length - 1) {
        return undefined
    }
    return { userId: presented.slice(0, separator), secret: presented.slice(separator + 1) }
}

export type InvalidChallengeReason =
    'format' | 'account' | 'unknown' | 'expired' | 'secret' | 'binding'

export class InvalidChallengeError extends BaseError {
    readonly statusCode = 400

    constructor(reason: InvalidChallengeReason) {
        super({
            name: 'InvalidChallengeError',
            message: 'The challenge does not authorize this operation',
            metadata: { reason }
        })
    }
}
