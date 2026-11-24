import { describe, expect, it } from 'vitest'
import { isChatGone } from './telegramTransport.js'

describe('isChatGone', () => {
    it('drops a chat whose user blocked the bot', () => {
        expect(
            isChatGone({
                ok: false,
                errorCode: 403,
                description: 'Forbidden: bot was blocked by the user'
            })
        ).toBe(true)
    })

    it('drops a chat that no longer exists', () => {
        expect(
            isChatGone({ ok: false, errorCode: 400, description: 'Bad Request: chat not found' })
        ).toBe(true)
    })

    it('keeps a chat through rate limits and other errors', () => {
        expect(
            isChatGone({
                ok: false,
                errorCode: 429,
                description: 'Too Many Requests: retry after 5'
            })
        ).toBe(false)
        expect(
            isChatGone({
                ok: false,
                errorCode: 400,
                description: 'Bad Request: message is too long'
            })
        ).toBe(false)
        expect(isChatGone({ ok: true, result: {} })).toBe(false)
    })
})
