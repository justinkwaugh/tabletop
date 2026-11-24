import { Type } from 'typebox'
import * as Value from 'typebox/value'

const API_ENDPOINT = 'https://api.telegram.org'

export type TelegramResult =
    { ok: true; result: unknown } | { ok: false; errorCode: number; description: string }

export type TelegramInlineKeyboardButton = { text: string; url: string }

export type TelegramSendMessage = {
    chat_id: string
    text: string
    parse_mode?: 'HTML'
    link_preview_options?: { is_disabled: boolean }
    reply_markup?: { inline_keyboard: TelegramInlineKeyboardButton[][] }
}

const TelegramResponse = Type.Union([
    Type.Object({ ok: Type.Literal(true), result: Type.Unknown() }),
    Type.Object({
        ok: Type.Literal(false),
        error_code: Type.Optional(Type.Number()),
        description: Type.Optional(Type.String())
    })
])

const TelegramBotUser = Type.Object({ username: Type.String() })

export class TelegramBotApi {
    private username: Promise<string> | undefined

    constructor(private readonly botToken: string) {}

    async sendMessage(message: TelegramSendMessage): Promise<TelegramResult> {
        return this.call('sendMessage', message)
    }

    async botUsername(): Promise<string> {
        this.username ??= this.readBotUsername().catch((error: unknown) => {
            this.username = undefined
            throw error
        })
        return this.username
    }

    private async readBotUsername(): Promise<string> {
        const response = await this.call('getMe', {})
        if (!response.ok) {
            throw new Error(`Telegram getMe failed: ${response.description}`)
        }
        if (!Value.Check(TelegramBotUser, response.result)) {
            throw new Error('Telegram getMe returned no username')
        }
        return response.result.username
    }

    private async call(method: string, body: object): Promise<TelegramResult> {
        const response = await fetch(`${API_ENDPOINT}/bot${this.botToken}/${method}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(body)
        })
        const parsed: unknown = await response.json().catch(() => undefined)
        if (Value.Check(TelegramResponse, parsed)) {
            if (parsed.ok) return { ok: true, result: parsed.result }
            return {
                ok: false,
                errorCode: parsed.error_code ?? response.status,
                description: parsed.description ?? response.statusText
            }
        }
        return { ok: false, errorCode: response.status, description: response.statusText }
    }
}
