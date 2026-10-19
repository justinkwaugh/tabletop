const API_ENDPOINT = 'https://discord.com/api/v10'

export type DiscordFile = {
    filename: string
    contentType: string
    content: string | Uint8Array<ArrayBuffer>
}

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

    // Discord takes files as multipart parts named files[n], with the JSON body in payload_json.
    async postWithFiles(path: string, body: unknown, files: DiscordFile[]): Promise<Response> {
        const form = new FormData()
        form.append('payload_json', JSON.stringify(body))
        files.forEach((file, index) => {
            form.append(
                `files[${index}]`,
                new Blob([file.content], { type: file.contentType }),
                file.filename
            )
        })
        return await fetch(`${API_ENDPOINT}${path}`, {
            method: 'POST',
            headers: this.headers(),
            body: form
        })
    }

    private headers(): Record<string, string> {
        return {
            Authorization: `Bot ${this.botToken}`,
            Accept: 'application/json'
        }
    }
}
