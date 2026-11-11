import { describe, expect, it, vi } from 'vitest'
import type { Resend } from 'resend'
import { ResendEmailService } from './resendEmailService.js'

async function serviceWithSpiedSend() {
    const service = await ResendEmailService.createEmailService({
        getSecret: async () => 're_test_key'
    })
    const emails: Resend['emails'] = Reflect.get(Reflect.get(service, 'resend'), 'emails')
    const send = vi.spyOn(emails, 'send').mockResolvedValue({
        data: { id: 'email-1' },
        error: null,
        headers: null
    })
    return { service, send }
}

describe('ResendEmailService', () => {
    it('renders the template when it sends', async () => {
        const { service, send } = await serviceWithSpiedSend()
        await service.sendVerificationEmail('verification-token', 'player@example.com')
        expect(send).toHaveBeenCalledWith(
            expect.objectContaining({
                to: 'player@example.com',
                html: expect.stringContaining('verification-token')
            })
        )
    })

    it('sends a plain-text part alongside the HTML', async () => {
        const { service, send } = await serviceWithSpiedSend()
        await service.sendPasswordResetEmail(
            'reset-token',
            'https://boardtogether.games/email/passwordReset/reset-token',
            'player@example.com'
        )
        const [payload] = send.mock.calls[0]
        const text = 'text' in payload ? payload.text : undefined
        expect(text?.startsWith('BOARD TOGETHER\n\nReset your password')).toBe(true)
        expect(text).toContain(
            'Reset password https://boardtogether.games/email/passwordReset/reset-token'
        )
        expect(text).not.toContain('<')
    })
})
