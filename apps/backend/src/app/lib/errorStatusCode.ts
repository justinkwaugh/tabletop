import { BaseError, ErrorCategory } from '@tabletop/common'

export function explicitStatusCode(error: unknown): number | undefined {
    if (
        error &&
        typeof error === 'object' &&
        'statusCode' in error &&
        typeof error.statusCode === 'number' &&
        Number.isInteger(error.statusCode) &&
        error.statusCode >= 400 &&
        error.statusCode <= 599
    )
        return error.statusCode
    return undefined
}

export function errorStatusCode(error: unknown): number {
    const explicit = explicitStatusCode(error)
    if (explicit !== undefined) return explicit
    return error instanceof BaseError && error.category === ErrorCategory.Application ? 400 : 500
}

// An authorization guard that refuses with its own status, such as a 403 for a missing mode,
// is more specific than the blanket 401 @fastify/auth sets before the error handler runs.
export function replyStatusCode(error: unknown, replyStatusCode: number): number {
    const explicit = explicitStatusCode(error)
    if (explicit !== undefined && explicit < 500) return explicit
    return replyStatusCode >= 400 ? replyStatusCode : errorStatusCode(error)
}
