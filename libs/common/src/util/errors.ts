interface ErrorOptions {
    category?: ErrorCategory
    name: string
    message: string
    metadata?: Record<string, unknown>
    cause?: Error
}

export enum ErrorCategory {
    Application = 'Application',
    System = 'System'
}

export class BaseError extends Error {
    readonly category: ErrorCategory
    readonly metadata: Record<string, unknown> = {}

    constructor({
        category = ErrorCategory.Application,
        name,
        message,
        metadata,
        cause
    }: ErrorOptions) {
        super(message, { cause })
        this.name = name
        this.category = category
        this.metadata = metadata || {}
    }
}
