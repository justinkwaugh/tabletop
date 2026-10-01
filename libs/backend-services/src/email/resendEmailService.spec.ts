import { describe, expect, it, vi } from 'vitest'
import type { Resend } from 'resend'
import { ResendEmailService } from './resendEmailService.js'

describe('ResendEmailService', () => {
    it('renders the template when it sends', async () => {
        const service = await ResendEmailService.createEmailService({
            getSecret: async () => 're_test_key'
        })
        const emails: Resend['emails'] = Reflect.get(Reflect.get(service, 'resend'), 'emails')
        const send = vi.spyOn(emails, 'send').mockResolvedValue({
            data: { id: 'email-1' },
            error: null
        })
        await service.sendVerificationEmail('verification-token', 'player@example.com')
        expect(send).toHaveBeenCalledWith(
            expect.objectContaining({
                to: 'player@example.com',
                html: expect.stringContaining('verification-token')
            })
        )
    })
})
