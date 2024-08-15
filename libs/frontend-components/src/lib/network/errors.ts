import { BaseError } from '@tabletop/common'

export class APIError extends BaseError {
    constructor({
        name,
        message,
        metadata
    }: {
        name: string
        message: string
        metadata?: Record<string, unknown>
    }) {
        super({
            name,
            message,
            metadata
        })
    }
}
