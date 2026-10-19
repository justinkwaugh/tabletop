import fastifyAuth from '@fastify/auth'
import {
    BUG_REPORT_DESCRIPTION_MAX_LENGTH,
    BUG_REPORT_SCREENSHOT_MAX_BASE64_LENGTH,
    BUG_REPORT_SCREENSHOT_MAX_COUNT,
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

const largestScreenshot = '/9j/'.padEnd(BUG_REPORT_SCREENSHOT_MAX_BASE64_LENGTH, 'A')

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

    it('takes the most screenshots a report may carry at their largest', async () => {
        const { server, reportBug } = await createServer({ configured: true })
        servers.add(server)
        const screenshots = Array.from({ length: BUG_REPORT_SCREENSHOT_MAX_COUNT }, () => largestScreenshot)

        const response = await server.inject({
            method: 'POST',
            url: '/reportBug',
            payload: { ...report, screenshots }
        })

        expect(response.statusCode).toBe(200)
        expect(reportBug).toHaveBeenCalledWith({ user, report: { ...report, screenshots } })
    })

    it('rejects more screenshots than a report may carry', async () => {
        const { server, reportBug } = await createServer({ configured: true })
        servers.add(server)

        const response = await server.inject({
            method: 'POST',
            url: '/reportBug',
            payload: {
                ...report,
                screenshots: Array.from({ length: BUG_REPORT_SCREENSHOT_MAX_COUNT + 1 }, () => '/9j/AA==')
            }
        })

        expect(response.statusCode).toBe(400)
        expect(reportBug).not.toHaveBeenCalled()
    })

    it('rejects a screenshot that is not a JPEG', async () => {
        const { server, reportBug } = await createServer({ configured: true })
        servers.add(server)

        const response = await server.inject({
            method: 'POST',
            url: '/reportBug',
            payload: { ...report, screenshots: ['iVBORw0KGgo='] }
        })

        expect(response.statusCode).toBe(400)
        expect(reportBug).not.toHaveBeenCalled()
    })

    it('rejects a screenshot over the size limit', async () => {
        const { server, reportBug } = await createServer({ configured: true })
        servers.add(server)

        const response = await server.inject({
            method: 'POST',
            url: '/reportBug',
            payload: { ...report, screenshots: [`${largestScreenshot}AAAA`] }
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
