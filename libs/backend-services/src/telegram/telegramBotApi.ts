const API_ENDPOINT = 'https://api.telegram.org'

export type TelegramResult<T> =
    { ok: true; result: T } | { ok: false; errorCode: number; description: string }

export type TelegramInlineKeyboardButton = { text: string; url: string }

export type TelegramSendMessage = {
    chat_id: string
    text: string
    parse_mode?: 'HTML'
    link_preview_options?: { is_disabled: boolean }
    reply_markup?: { inline_keyboard: TelegramInlineKeyboardButton[][] }
}

type TelegramResponseBody =
    { ok: true; result: unknown } | { ok: false; error_code?: number; description?: string }

/** Calls to the Telegram Bot API; failures Telegram reports come back as results, network failures throw. */
export class TelegramBotApi {
    private username: Promise<string> | undefined

    constructor(private readonly botToken: string) {}

    async sendMessage(message: TelegramSendMessage): Promise<TelegramResult<unknown>> {
        return this.call('sendMessage', message)
    }

    /** The bot's @username, read once from getMe; deep links need it. */
    async botUsername(): Promise<string> {
        this.username ??= this.call<{ username?: string }>('getMe', {}).then((response) => {
            if (!response.ok || !response.result.username) {
                this.username = undefined
                throw new Error(
                    `Telegram getMe failed: ${response.ok ? 'no username' : response.description}`
                )
            }
            return response.result.username
        })
        return this.username
    }

    private async call<T>(method: string, body: object): Promise<TelegramResult<T>> {
        const response = await fetch(`${API_ENDPOINT}/bot${this.botToken}/${method}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(body)
        })
        const parsed = (await response.json().catch(() => undefined)) as
            TelegramResponseBody | undefined
        if (parsed?.ok) {
            return { ok: true, result: parsed.result as T }
        }
        return {
            ok: false,
            errorCode: parsed?.error_code ?? response.status,
            description: parsed?.description ?? response.statusText
        }
    }
}
