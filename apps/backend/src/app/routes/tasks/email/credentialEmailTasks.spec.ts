import Fastify, { type FastifyInstance } from 'fastify'
import { Role, UserStatus, type User } from '@tabletop/common'
import { UserService, type EmailService } from '@tabletop/backend-services'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
    vi.stubEnv('GCLOUD_PROJECT', 'demo-tabletop')
    vi.stubEnv('FRONTEND_HOST', 'https://site.test')
})
import { LoggingBoundary } from '../../../lib/logging.js'
import {
    apiErrorShape,
    memoryTokens,
    memoryUserStore,
    recordingTasks
} from '../../../tests/accountFixture.js'
import sendPasswordResetEmail from './sendPasswordResetEmail.js'
import sendAuthVerificationEmail from './sendAuthVerificationEmail.js'
import sendVerificationEmail from './sendVerificationEmail.js'

const SECRET = 'SYNTHETIC-AUDIT-SECRET-5d2e'
const RESET_CHALLENGE = `account-1.${SECRET}`

type Delivery = { kind: 'verification' | 'reset'; token: string; toEmail: string; url?: string }

class RecordingEmailService implements EmailService {
    readonly deliveries: Delivery[] = []
    failure?: Error

    async sendVerificationEmail(token: string, toEmail: string): Promise<void> {
        this.deliver({ kind: 'verification', token, toEmail })
    }
    async sendPasswordResetEmail(token: string, url: string, toEmail: string): Promise<void> {
        this.deliver({ kind: 'reset', token, url, toEmail })
    }
    async sendAccountChangedNotificationEmail(): Promise<void> {}
    async sendGameInvitationEmail(): Promise<void> {}
    async sendGameEndEmail(): Promise<void> {}
    async sendTournamentResultsEmail(): Promise<void> {}
    async sendLeagueSignUpEmail(): Promise<void> {}
    async sendLeagueSeasonStartEmail(): Promise<void> {}
    async sendLeagueSeasonResultsEmail(): Promise<void> {}

    private deliver(delivery: Delivery) {
        if (this.failure) throw this.failure
        this.deliveries.push(delivery)
    }
}

function person(): User {
    return {
        id: 'account-1',
        username: 'Person',
        email: 'person@example.test',
        emailVerified: true,
        status: UserStatus.Active,
        roles: [Role.User],
        externalIds: []
    }
}

const servers = new Set<FastifyInstance>()
afterEach(async () => {
    for (const server of servers) await server.close()
    servers.clear()
})

async function taskServer() {
    const lines: string[] = []
    const consoleLines: string[] = []
    vi.spyOn(console, 'log').mockImplementation((...args) => {
        consoleLines.push(args.map(String).join(' '))
    })
    vi.spyOn(console, 'error').mockImplementation((...args) => {
        consoleLines.push(args.map(String).join(' '))
    })
    const server = Fastify({
        logger: {
            ...new LoggingBoundary().loggerOptions,
            stream: {
                write: (line: string) => {
                    lines.push(line)
                }
            }
        }
    })
    servers.add(server)
    apiErrorShape(server)
    const { store } = memoryUserStore(person())
    const emails = new RecordingEmailService()
    server.decorate(
        'userService',
        new UserService(store, memoryTokens().tokenService, recordingTasks().tasks)
    )
    server.decorate('emailService', emails)
    await server.register(sendPasswordResetEmail, { prefix: '/tasks' })
    await server.register(sendAuthVerificationEmail, { prefix: '/tasks' })
    await server.register(sendVerificationEmail, { prefix: '/tasks' })
    const run = (task: string, userId: string, token: string) =>
        server.inject({ method: 'POST', url: `/tasks/${task}`, payload: { userId, token } })
    return { run, emails, logged: () => [...lines, ...consoleLines].join('') }
}

describe('credential email tasks', () => {
    it('deliver the Set Password link without writing the challenge to the log', async () => {
        const { run, emails, logged } = await taskServer()

        const response = await run('sendPasswordResetEmail', 'account-1', RESET_CHALLENGE)

        expect(response.statusCode).toBe(200)
        expect(emails.deliveries).toEqual([
            {
                kind: 'reset',
                token: RESET_CHALLENGE,
                url: `https://site.test/email/passwordReset/${RESET_CHALLENGE}`,
                toEmail: 'person@example.test'
            }
        ])
        expect(logged()).toContain('"userId":"account-1"')
        expect(logged()).toContain('"kind":"password-reset"')
        expect(logged()).toContain('Sending credential email')
        expect(logged()).not.toContain(SECRET)
    })

    it('deliver verification and Sensitive Change codes without logging them', async () => {
        const { run, emails, logged } = await taskServer()

        expect((await run('sendVerificationEmail', 'account-1', '123456')).statusCode).toBe(200)
        expect((await run('sendAuthVerificationEmail', 'account-1', '654321')).statusCode).toBe(200)

        expect(emails.deliveries.map((delivery) => delivery.token)).toEqual(['123456', '654321'])
        expect(logged()).toContain('"kind":"email-verification"')
        expect(logged()).toContain('"kind":"sensitive-change"')
        expect(logged()).not.toContain('123456')
        expect(logged()).not.toContain('654321')
    })

    it('report a failed delivery without the challenge, even when the provider quotes it', async () => {
        const { run, emails, logged } = await taskServer()
        emails.failure = Object.assign(new Error(`Resend rejected ${RESET_CHALLENGE}`), {
            response: { body: { token: RESET_CHALLENGE, reason: 'rate limited' } }
        })

        const response = await run('sendPasswordResetEmail', 'account-1', RESET_CHALLENGE)

        expect(response.statusCode).toBe(500)
        expect(response.json().error.name).toBe('EmailDeliveryError')
        expect(response.body).not.toContain(SECRET)
        expect(logged()).toContain('"level":50')
        expect(logged()).toContain('EmailDeliveryError')
        expect(logged()).toContain('Resend rejected')
        expect(logged()).toContain('"kind":"password-reset"')
        expect(logged()).not.toContain(SECRET)
    })

    it('report a missing recipient without the challenge', async () => {
        const { run, emails, logged } = await taskServer()

        const response = await run('sendPasswordResetEmail', 'nobody', RESET_CHALLENGE)

        expect(response.statusCode).toBe(200)
        expect(emails.deliveries).toEqual([])
        expect(logged()).toContain('cannot send credential email')
        expect(logged()).toContain('"userId":"nobody"')
        expect(logged()).not.toContain(SECRET)
    })
})
