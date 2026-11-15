import { SecretsService } from '../secrets/secretsService.js'
import Ably from 'ably'

export const ABLY_CLIENT_OPERATIONS = ['subscribe'] as const

export type AblyClientCapability = Record<string, (typeof ABLY_CLIENT_OPERATIONS)[number][]>

export function ablyClientCapability(topics: string[]): AblyClientCapability {
    return Object.fromEntries(topics.map((topic) => [topic, [...ABLY_CLIENT_OPERATIONS]]))
}

export class AblyService {
    private ably: Ably.Rest

    static async createAblyService(secretsService: SecretsService): Promise<AblyService> {
        const ablyApiKey = await secretsService.getSecret('ABLY_API_KEY')
        return new AblyService(ablyApiKey)
    }

    constructor(private readonly ablyApiKey: string) {
        this.ably = new Ably.Rest(ablyApiKey)
    }

    async createTokenRequest({
        userId,
        topics
    }: {
        userId: string
        topics: string[]
    }): Promise<Ably.TokenRequest> {
        return await this.ably.auth.createTokenRequest({
            clientId: userId,
            capability: ablyClientCapability(topics)
        })
    }
}
