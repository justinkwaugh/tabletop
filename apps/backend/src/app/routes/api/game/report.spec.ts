import fastifyAuth from '@fastify/auth'
import {
    ContentReportReason,
    ContentReportTargetKind,
    Role,
    UserStatus,
    type ContentReportRequest,
    type User
} from '@tabletop/common'
import Fastify from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'
import reportRoute from './report.js'

const user: User = {
    id: 'user-1',
    status: UserStatus.Active,
    roles: [Role.User],
    externalIds: []
}

async function createServer({ configured }: { configured: boolean }) {
    const server = Fastify()
    await server.register(fastifyAuth)
    Reflect.set(server, 'verifyActiveUser', async (request: { user?: User }) => {
        request.user = user
    })
    Reflect.set(server, 'verifyRoleUser', async () => undefined)
    const report = vi.fn(async () => undefined)
    Reflect.set(server, 'contentReports', configured ? { report } : undefined)
    await server.register(reportRoute)
    return { server, report }
}

describe('POST /report', () => {
    const servers = new Set<ReturnType<typeof Fastify>>()

    afterEach(async () => {
        await Promise.all([...servers].map((server) => server.close()))
        servers.clear()
    })

    it('passes every kind of target through validation intact', async () => {
        const { server, report } = await createServer({ configured: true })
        servers.add(server)
        const requests: ContentReportRequest[] = [
            {
                gameId: 'g1',
                target: { kind: ContentReportTargetKind.ConversationMessage, messageId: 'm1' },
                reason: ContentReportReason.Bullying,
                details: 'every game today'
            },
            {
                gameId: 'g1',
                target: { kind: ContentReportTargetKind.Username, playerId: 'seat-bob' },
                reason: ContentReportReason.Hate
            },
            {
                gameId: 'g1',
                target: { kind: ContentReportTargetKind.GameName },
                reason: ContentReportReason.SexualContent
            }
        ]

        for (const payload of requests) {
            const response = await server.inject({ method: 'POST', url: '/report', payload })
            expect(response.statusCode).toBe(200)
            expect(report).toHaveBeenLastCalledWith(user, payload)
        }
    })

    it('refuses an unknown reason or a target missing its field', async () => {
        const { server, report } = await createServer({ configured: true })
        servers.add(server)

        for (const payload of [
            { gameId: 'g1', target: { kind: 'gameName' }, reason: 'rude' },
            { gameId: 'g1', target: { kind: 'username' }, reason: 'hate' },
            { gameId: 'g1', target: { kind: 'conversationMessage' }, reason: 'hate' }
        ]) {
            const response = await server.inject({ method: 'POST', url: '/report', payload })
            expect(response.statusCode).toBe(400)
        }
        expect(report).not.toHaveBeenCalled()
    })

    it('answers 503 when no moderation address is configured', async () => {
        const { server } = await createServer({ configured: false })
        servers.add(server)

        const response = await server.inject({
            method: 'POST',
            url: '/report',
            payload: {
                gameId: 'g1',
                target: { kind: ContentReportTargetKind.GameName },
                reason: ContentReportReason.Other
            }
        })

        expect(response.statusCode).toBe(503)
    })
})
