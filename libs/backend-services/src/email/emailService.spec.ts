import { expect, it, vi } from 'vitest'

vi.mock('@tabletop/email', () => {
    throw new Error('Email templates must not load before delivery')
})

it('exposes account change types without loading the email templates', async () => {
    const { AccountChangeType } = await import('./emailService.js')
    expect(AccountChangeType.EmailChangeRequested).toBe('emailChangeRequested')
})
