import { z } from 'zod'
import { m } from '$lib/paraglide/messages'

export function emailAddress() {
    return z.email({
        error: (issue) =>
            issue.input === undefined
                ? m.auth_validation_required()
                : m.auth_validation_invalid_email()
    })
}
