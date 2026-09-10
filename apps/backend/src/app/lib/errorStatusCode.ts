import { BaseError, ErrorCategory } from '@tabletop/common'

export function errorStatusCode(error: unknown): number {
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
    return error instanceof BaseError && error.category === ErrorCategory.Application ? 400 : 500
}
