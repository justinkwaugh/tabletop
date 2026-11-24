import { Type } from 'typebox'
import * as Value from 'typebox/value'
import { RESTPostAPIWebhookWithTokenJSONBody, WebhookType } from 'discord-api-types/v10'

const API_ENDPOINT = 'https://discord.com/api/v10'
const REQUEST_TIMEOUT_MS = 10_000

const WEBHOOK_URL =
    /^https:\/\/(?:(?:ptb|canary)\.)?discord(?:app)?\.com\/api(?:\/v\d+)?\/webhooks\/(\d{1,20})\/([A-Za-z0-9_-]{1,100})\/?$/

export type DiscordWebhookCredentials = {
    id: string
    token: string
}

export type DiscordWebhookLookup =
    | { kind: 'found'; name: string }
    | { kind: 'gone' }
    | { kind: 'unsupported' }
    | { kind: 'failed'; status: number }

export type DiscordWebhookDelivery = { ok: true } | { ok: false; status: number; gone: boolean }

const Webhook = Type.Object({
    type: Type.Number(),
    name: Type.Union([Type.String(), Type.Null()])
})

export function parseDiscordWebhookUrl(url: string): DiscordWebhookCredentials | undefined {
    const match = WEBHOOK_URL.exec(url.trim())
    return match ? { id: match[1], token: match[2] } : undefined
}

// Webhook URLs carry their own credential, so every call goes to the fixed Discord host.
export class DiscordWebhookApi {
    async lookup(webhook: DiscordWebhookCredentials): Promise<DiscordWebhookLookup> {
        const response = await fetch(this.webhookUrl(webhook), {
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
        })
        if (this.isGone(response.status)) {
            return { kind: 'gone' }
        }
        if (!response.ok) {
            return { kind: 'failed', status: response.status }
        }

        const body: unknown = await response.json()
        if (!Value.Check(Webhook, body)) {
            return { kind: 'failed', status: response.status }
        }
        // Channel-follower and application webhooks can't be posted to with a token.
        if (body.type !== WebhookType.Incoming) {
            return { kind: 'unsupported' }
        }
        return { kind: 'found', name: body.name ?? '' }
    }

    async execute(
        webhook: DiscordWebhookCredentials,
        message: RESTPostAPIWebhookWithTokenJSONBody
    ): Promise<DiscordWebhookDelivery> {
        const response = await fetch(this.webhookUrl(webhook), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(message),
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
        })
        if (response.ok) {
            return { ok: true }
        }
        return { ok: false, status: response.status, gone: this.isGone(response.status) }
    }

    // 401: the token was regenerated. 404: the webhook or its channel was deleted.
    private isGone(status: number): boolean {
        return status === 401 || status === 404
    }

    private webhookUrl(webhook: DiscordWebhookCredentials): string {
        return `${API_ENDPOINT}/webhooks/${webhook.id}/${webhook.token}`
    }
}
