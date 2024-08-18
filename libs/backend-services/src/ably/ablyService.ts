import { SecretsService } from '../secrets/secretsService.js'
import Ably from 'ably'

export class AblyService {
    private ably: Ably.Rest

    static async createAblyService(secretsService: SecretsService): Promise<AblyService> {
        const ablyApiKey = await secretsService.getSecret('ABLY_API_KEY')
        return new AblyService(ablyApiKey)
    }

    constructor(private readonly ablyApiKey: string) {
        this.ably = new Ably.Rest(ablyApiKey)
    }

    async createTokenRequest(userId: string): Promise<Ably.TokenRequest> {
        return await this.ably.auth.createTokenRequest({ clientId: userId })
    }
}
