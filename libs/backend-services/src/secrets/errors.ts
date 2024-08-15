import { BaseError } from '@tabletop/common'

enum SecretsServiceError {
    MissingSecret = 'MissingSecretError'
}

export class MissingSecretError extends BaseError {
    constructor(secretName: string) {
        super({
            name: SecretsServiceError.MissingSecret,
            message: `The requested secret ${secretName} was not found`,
            metadata: { secretName }
        })
    }
}
