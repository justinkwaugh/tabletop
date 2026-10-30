import * as Type from 'typebox'

export const AUTHENTICATION_CHALLENGE_LIFETIME_SECONDS = 15 * 60

export function normalizeEmailAddress(email: string): string {
    return email.trim().toLowerCase()
}

export type SensitiveChangeOperation = Type.Static<typeof SensitiveChangeOperation>
export const SensitiveChangeOperation = Type.Object({
    email: Type.Optional(Type.String()),
    password: Type.Boolean()
})

export type SensitiveChangeRequest = Type.Static<typeof SensitiveChangeRequest>
export const SensitiveChangeRequest = Type.Object({
    email: Type.Optional(Type.String()),
    password: Type.Optional(Type.Boolean())
})

export function sensitiveChangeOperation({
    email,
    password
}: SensitiveChangeRequest): SensitiveChangeOperation {
    const normalizedEmail = email === undefined ? undefined : normalizeEmailAddress(email)
    return {
        ...(normalizedEmail ? { email: normalizedEmail } : {}),
        password: password === true
    }
}
