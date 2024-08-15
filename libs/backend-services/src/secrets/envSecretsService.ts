import { MissingSecretError } from './errors.js'
import { SecretsService } from './secretsService.js'

export class EnvSecretsService implements SecretsService {
    async getSecret(secretName: string): Promise<string> {
        const secret = process.env[secretName]
        if (secret === undefined || secret === null) {
            throw new MissingSecretError(secretName)
        }

        return secret
    }
}
