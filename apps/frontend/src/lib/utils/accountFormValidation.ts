import { z } from 'zod'

// Wording carried over from zod 3's defaults, which zod 4 rewrote, so the account forms read as before.
export const requiredMessage = 'Required'
export const invalidEmailMessage = 'Invalid email'

export function minLengthMessage(length: number) {
    return `String must contain at least ${length} character(s)`
}

export function emailAddress() {
    return z.email({
        error: (issue) => (issue.input === undefined ? requiredMessage : invalidEmailMessage)
    })
}
