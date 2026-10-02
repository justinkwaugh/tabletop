import fastifyAuth from '@fastify/auth'
import {
    BUG_REPORT_DESCRIPTION_MAX_LENGTH,
    Role,
    type BugReportRequest,
    type User,
    UserStatus
} from '@tabletop/common'
import Fastify from 'fastify'
import { afterEach, describe, expect, it, vi } from 'vitest'
import reportBugRoute from './reportBug.js'

const user: User = {
    id: 'user-1',
    status: UserStatus.Active,
    roles: [Role.User],
    externalIds: []
}

const report: BugReportRequest = {
    gameId: 'game-1',
    description: 'The canal would not place',
    view: { actionCount: 12, inHistory: true, exploring: false },
    versions: { site: '1.40.0', logic: '2.2.0', ui: '3.3.0' },
    client: { userAgent: 'test', viewport: '800x600 @1x', installedApp: false }
}

async function createServer({ configured }: { configured: boolean }) {
    const server = Fastify()
    await server.register(fastifyAuth)

    Reflect.set(server, 'verifyActiveUser', async (request: { user?: User }) => {
        request.user = user
    })
    Reflect.set(server, 'verifyRoleUser', async () => undefined)

    const reportBug = vi.fn(async () => undefined)
    Reflect.set(server, 'bugReportService', configured ? { reportBug } : undefined)

    await server.register(reportBugRoute)
    return { server, reportBug }
}

describe('POST /reportBug', () => {
    const servers = new Set<ReturnType<typeof Fastify>>()

    afterEach(async () => {
        await Promise.all([...servers].map((server) => server.close()))
        servers.clear()
    })

    it('reports the bug for the authenticated User', async () => {
        const { server, reportBug } = await createServer({ configured: true })
        servers.add(server)

        const response = await server.inject({ method: 'POST', url: '/reportBug', payload: report })

        expect(response.statusCode).toBe(200)
        expect(response.json()).toEqual({ status: 'ok' })
        expect(reportBug).toHaveBeenCalledWith({ user, report })
    })

    it('rejects a description over the length limit', async () => {
        const { server, reportBug } = await createServer({ configured: true })
        servers.add(server)

        const response = await server.inject({
            method: 'POST',
            url: '/reportBug',
            payload: { ...report, description: 'x'.repeat(BUG_REPORT_DESCRIPTION_MAX_LENGTH + 1) }
        })

        expect(response.statusCode).toBe(400)
        expect(reportBug).not.toHaveBeenCalled()
    })

    it('is unavailable when no bug report forum is configured', async () => {
        const { server } = await createServer({ configured: false })
        servers.add(server)

        const response = await server.inject({ method: 'POST', url: '/reportBug', payload: report })

        expect(response.statusCode).toBe(503)
    })
})
