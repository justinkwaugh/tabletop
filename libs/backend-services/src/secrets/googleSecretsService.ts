import { MissingSecretError } from './errors.js'
import { SecretsService } from './secretsService.js'
import { SecretManagerServiceClient } from '@google-cloud/secret-manager'

export class GoogleSecretsService implements SecretsService {
    private client: SecretManagerServiceClient

    constructor() {
        this.client = new SecretManagerServiceClient()
    }

    // Can't get this to work with ADC
    async getSecret(secretName: string): Promise<string> {
        const projectId = await this.client.getProjectId()
        const name = this.client.projectSecretSecretVersionPath(projectId, secretName, 'latest')
        console.log('Getting secret', name)
        const [version] = await this.client.accessSecretVersion({
            name: secretName
        })

        if (!version.payload?.data) {
            throw new MissingSecretError(secretName)
        }

        return version.payload.data.toString()
    }
}
