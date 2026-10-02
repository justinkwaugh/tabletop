const API_ENDPOINT = 'https://discord.com/api/v10'

export class DiscordBotApi {
    constructor(private readonly botToken: string) {}

    async get(path: string): Promise<Response> {
        return await fetch(`${API_ENDPOINT}${path}`, { headers: this.headers() })
    }

    async post(path: string, body: unknown): Promise<Response> {
        return await fetch(`${API_ENDPOINT}${path}`, {
            method: 'POST',
            headers: { ...this.headers(), 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        })
    }

    private headers(): Record<string, string> {
        return {
            Authorization: `Bot ${this.botToken}`,
            Accept: 'application/json'
        }
    }
}
