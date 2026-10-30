import { type Static, Type } from 'typebox'
import { BaseError, SensitiveChangeOperation } from '@tabletop/common'
import { TokenType } from './dataToken.js'

export type SetPasswordClaim = Static<typeof SetPasswordClaim>
export const SetPasswordClaim = Type.Object({
    type: Type.Literal(TokenType.PasswordReset),
    userId: Type.String(),
    email: Type.String()
})

export type EmailVerificationClaim = Static<typeof EmailVerificationClaim>
export const EmailVerificationClaim = Type.Object({
    type: Type.Literal(TokenType.EmailVerification),
    userId: Type.String(),
    email: Type.String()
})

export type SensitiveChangeClaim = Static<typeof SensitiveChangeClaim>
export const SensitiveChangeClaim = Type.Object({
    type: Type.Literal(TokenType.SensitiveChange),
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

export type IssuedChallenge = {
    secret: string
    expiresAt: Date
}

const PRESENTATION_SEPARATOR = '.'

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

    constructor(reason?: InvalidChallengeReason) {
        super({
            name: 'InvalidChallengeError',
            message: 'The challenge does not authorize this operation',
            metadata: reason === undefined ? undefined : { reason }
        })
    }
}
