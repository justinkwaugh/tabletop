import { describe, expect, it } from 'vitest'
import { parseDiscordWebhookUrl } from './discordWebhookApi.js'

describe('parseDiscordWebhookUrl', () => {
    it('reads the id and token from the URL Discord gives', () => {
        expect(
            parseDiscordWebhookUrl(
                'https://discord.com/api/webhooks/123456789012345678/abc_DEF-123'
            )
        ).toEqual({ id: '123456789012345678', token: 'abc_DEF-123' })
    })

    it('accepts the older host, the test builds and a versioned path', () => {
        for (const url of [
            'https://discordapp.com/api/webhooks/1/token',
            'https://ptb.discord.com/api/webhooks/1/token',
            'https://canary.discord.com/api/v10/webhooks/1/token/',
            '  https://discord.com/api/webhooks/1/token  '
        ]) {
            expect(parseDiscordWebhookUrl(url)).toEqual({ id: '1', token: 'token' })
        }
    })

    it('refuses any other address', () => {
        for (const url of [
            'http://discord.com/api/webhooks/1/token',
            'https://discord.com.evil.test/api/webhooks/1/token',
            'https://evil.test/discord.com/api/webhooks/1/token',
            'https://discord.com/api/webhooks/1/token/../../users',
            'https://discord.com/api/webhooks/1/token?thread_id=2',
            'https://discord.com/api/webhooks/abc/token',
            'not a url'
        ]) {
            expect(parseDiscordWebhookUrl(url)).toBeUndefined()
        }
    })
})
