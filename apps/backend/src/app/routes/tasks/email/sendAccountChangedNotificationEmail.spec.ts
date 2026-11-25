import Fastify from 'fastify'
import { AccountChangeType, Role, UserStatus, type User } from '@tabletop/common'
import { afterEach, describe, expect, it, vi } from 'vitest'
import sendAccountChangedNotificationEmail from './sendAccountChangedNotificationEmail.js'

vi.hoisted(() => vi.stubEnv('GCLOUD_PROJECT', 'demo-tabletop'))

const account: User = {
    id: 'account-1',
    email: 'current@example.test',
    seenLocale: 'fr',
    timeZone: 'Europe/Paris',
    status: UserStatus.Active,
    roles: [Role.User],
    externalIds: []
}

async function send(payload: Record<string, unknown>) {
    const server = Fastify()
    const email = vi.fn(async () => undefined)
    const getUserByEmail = vi.fn(async (address: string) =>
        address === account.email ? account : undefined
    )
    Reflect.set(server, 'userService', { getUserByEmail })
    Reflect.set(server, 'emailService', { sendAccountChangedNotificationEmail: email })
    await server.register(sendAccountChangedNotificationEmail)
    const response = await server.inject({
        method: 'POST',
        url: '/sendAccountChangedNotificationEmail',
        payload: {
            changeType: AccountChangeType.AccountDeleted,
            timestamp: '2026-11-25T12:00:00.000Z',
            ...payload
        }
    })
    await server.close()
    return { response, email, getUserByEmail }
}

describe('POST /sendAccountChangedNotificationEmail', () => {
    afterEach(() => vi.restoreAllMocks())

    it('writes in the language and time zone the account had when the change was queued', async () => {
        const { response, email, getUserByEmail } = await send({
            email: 'gone@example.test',
            locale: 'de',
            timeZone: 'Europe/Berlin'
        })
        expect(response.statusCode).toBe(200)
        expect(email).toHaveBeenCalledExactlyOnceWith(
            AccountChangeType.AccountDeleted,
            new Date('2026-11-25T12:00:00.000Z'),
            { email: 'gone@example.test', locale: 'de', timeZone: 'Europe/Berlin' },
            undefined
        )
        expect(getUserByEmail).not.toHaveBeenCalled()
    })

    it('finds the account by address for a task queued without a language', async () => {
        const { email } = await send({ email: 'current@example.test' })
        expect(email).toHaveBeenCalledWith(
            AccountChangeType.AccountDeleted,
            expect.any(Date),
            { email: 'current@example.test', locale: 'fr', timeZone: 'Europe/Paris' },
            undefined
        )
    })

    it('writes in English and UTC when no account holds the address', async () => {
        const { email } = await send({ email: 'gone@example.test' })
        expect(email).toHaveBeenCalledWith(
            AccountChangeType.AccountDeleted,
            expect.any(Date),
            { email: 'gone@example.test', locale: 'en' },
            undefined
        )
    })
})
