const API_ENDPOINT = 'https://discord.com/api/v10'

export class DiscordBotApi {
    constructor(private readonly botToken: string) {}

    async post(path: string, body: unknown): Promise<Response> {
        return await fetch(`${API_ENDPOINT}${path}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bot ${this.botToken}`,
                Accept: 'application/json'
            },
            body: JSON.stringify(body)
        })
    }
}
