import { describe, expect, it, vi } from 'vitest'
import type { Resend } from 'resend'
import { ResendEmailService } from './resendEmailService.js'
import type { EmailRecipient } from './emailService.js'

const player: EmailRecipient = { email: 'player@example.com', locale: 'en' }

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
        await service.sendVerificationEmail('verification-token', player)
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
            player
        )
        const [payload] = send.mock.calls[0]
        const text = 'text' in payload ? payload.text : undefined
        expect(text?.startsWith('BOARD TOGETHER\n\nReset your password')).toBe(true)
        expect(text).toContain(
            'Reset password https://boardtogether.games/email/passwordReset/reset-token'
        )
        expect(text).not.toContain('<')
    })

    it("writes the subject and dates in the recipient's language and time zone", async () => {
        const { service, send } = await serviceWithSpiedSend()
        await service.sendLeagueSignUpEmail({
            to: { email: 'spieler@example.com', locale: 'de', timeZone: 'Europe/Berlin' },
            reminder: false,
            leagueName: 'Frischfisch-Liga',
            title: 'Fresh Fish',
            seasonNumber: 2,
            level: 'B',
            closesAt: Date.UTC(2026, 9, 23, 18),
            url: 'https://boardtogether.games/leagues/frischfisch'
        })
        const [payload] = send.mock.calls[0]
        expect(payload.subject).toBe('Die Anmeldung für Frischfisch-Liga, Saison 2, ist geöffnet')
        const text = 'text' in payload ? payload.text : undefined
        expect(text).toContain('bevor die Anmeldung am Freitag, 23. Oktober um 20:00 MESZ endet')
    })

    it('tells a recipient with no known time zone the time in UTC', async () => {
        const { service, send } = await serviceWithSpiedSend()
        await service.sendLeagueSignUpEmail({
            to: player,
            reminder: false,
            leagueName: 'Fresh Fish League',
            title: 'Fresh Fish',
            seasonNumber: 2,
            level: 'B',
            closesAt: Date.UTC(2026, 9, 23, 18),
            url: 'https://boardtogether.games/leagues/fresh-fish-league'
        })
        const [payload] = send.mock.calls[0]
        expect(payload.subject).toBe('Sign-up for Fresh Fish League Season 2 is open')
        const text = 'text' in payload ? payload.text : undefined
        expect(text).toContain('before sign-up closes on Friday, October 23 at 6:00 PM UTC.')
    })
})
