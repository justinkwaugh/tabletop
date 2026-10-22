import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import * as http2 from 'node:http2'
import * as http from 'node:http'
import { connect } from 'node:net'
import { BackendSupervisor } from './backendSupervisor.js'
import { createBackendGateway } from './backendGateway.js'
import { createBackendHealthServer } from './backendHealth.js'

describe('supervised backend worker', () => {
    let directory: string
    let config: string
    let supervisor: BackendSupervisor
    let gateway: ReturnType<typeof createBackendGateway>
    let origin: string
    let health: http.Server | undefined
    let healthOrigin: string

    beforeEach(async () => {
        health = undefined
        directory = await mkdtemp(join(tmpdir(), 'backend-worker-'))
        config = join(directory, 'config.json')
        await writeFile(config, '{}')
        await writeFile(join(directory, 'asset.js'), 'console.log("loaded")')
        vi.stubEnv('BACKEND_FIXTURE_CONFIG', config)
    })
    afterEach(async () => {
        health?.close()
        health?.closeAllConnections()
        await Promise.all([gateway?.close(), supervisor?.close()])
        vi.unstubAllEnvs()
        await rm(directory, { recursive: true, force: true })
    })
    async function start({
        http2Enabled = false,
        drainTimeoutMs = 2_000,
        fixture = 'backend.mjs',
        titleLoadGraceMs
    }: {
        http2Enabled?: boolean
        drainTimeoutMs?: number
        fixture?: string
        titleLoadGraceMs?: number
    } = {}) {
        supervisor = new BackendSupervisor({
            entry: new URL(`./fixtures/${fixture}`, import.meta.url),
            startupTimeoutMs: 1_000,
            drainTimeoutMs,
            retryDelayMs: 100,
            titleLoadGraceMs
        })
        await supervisor.start()
        gateway = createBackendGateway(http2Enabled, supervisor)
        gateway.server.listen(0, '127.0.0.1')
        await once(gateway.server, 'listening')
        const address = gateway.server.address()
        if (!address || typeof address === 'string') throw new Error('No listener')
        origin = `http://127.0.0.1:${address.port}`
        health = createBackendHealthServer(supervisor, () => gateway.server.listening)
        health.listen(0, '127.0.0.1')
        await once(health, 'listening')
        const healthAddress = health.address()
        if (!healthAddress || typeof healthAddress === 'string')
            throw new Error('No health listener')
        healthOrigin = `http://127.0.0.1:${healthAddress.port}`
    }
    async function get(path = '/') {
        const response = await fetch(origin + path)
        expect(response.status).toBe(200)
        return response.json()
    }
    async function events(): Promise<Array<{ event: string; pid: number }>> {
        return (await readFile(`${config}.events`, 'utf8'))
            .trim()
            .split('\n')
            .map((line) => JSON.parse(line))
    }
    async function expectExited(pid: number) {
        await vi.waitFor(() => expect(() => process.kill(pid, 0)).toThrow(), { timeout: 3_000 })
    }

    it('fails readiness and holds requests during child recovery, then restores readiness', async () => {
        await start()
        const old = await get()
        expect((await fetch(healthOrigin + '/__health/ready')).status).toBe(200)
        await writeFile(config, JSON.stringify({ startupDelay: 400 }))
        expect((await fetch(origin + '/crash')).status).toBe(502)
        expect((await fetch(healthOrigin + '/__health/ready')).status).toBe(503)
        expect((await fetch(origin + '/__health/ready')).status).toBe(503)
        let finished = false
        const waiting = get().then((result) => {
            finished = true
            return result
        })
        await new Promise((resolve) => setTimeout(resolve, 30))
        expect(finished).toBe(false)
        expect((await waiting).pid).not.toBe(old.pid)
        expect((await fetch(healthOrigin + '/__health/ready')).status).toBe(200)
        await supervisor.close()
        expect((await fetch(healthOrigin + '/__health/ready')).status).toBe(503)
    })

    it('fails readiness when the child is alive but unresponsive', async () => {
        await start()
        const child = await get()
        process.kill(child.pid, 'SIGSTOP')
        try {
            expect((await fetch(healthOrigin + '/__health/ready')).status).toBe(503)
        } finally {
            process.kill(child.pid, 'SIGCONT')
        }
        expect((await fetch(healthOrigin + '/__health/ready')).status).toBe(200)
    })

    it('logs how long a stalled worker took to answer its health check', async () => {
        await start()
        const child = await get()
        const log = vi.spyOn(console, 'log')
        process.kill(child.pid, 'SIGSTOP')
        try {
            expect((await fetch(healthOrigin + '/__health/ready')).status).toBe(503)
            await new Promise((resolve) => setTimeout(resolve, 300))
        } finally {
            process.kill(child.pid, 'SIGCONT')
        }
        await vi.waitFor(() => {
            const stall = log.mock.calls
                .map(([line]) => (typeof line === 'string' ? line : ''))
                .find((line) => line.includes('"event":"worker_stall"'))
            expect(stall && JSON.parse(stall)).toMatchObject({
                severity: 'WARNING',
                answered: true,
                waitedMs: expect.any(Number)
            })
            expect(JSON.parse(stall ?? '{}').waitedMs).toBeGreaterThanOrEqual(1_300)
        })
        log.mockRestore()
    })

    it('stays ready while the worker is blocked by a title load it announced', async () => {
        await start()
        const load = fetch(origin + '/load-title?ms=1500')
        await vi.waitFor(() => expect(supervisor.vouchingForTitleLoad()).toBe(true))
        expect((await fetch(healthOrigin + '/__health/ready')).status).toBe(200)
        expect((await load).status).toBe(200)
        await vi.waitFor(() => expect(supervisor.vouchingForTitleLoad()).toBe(false))
    })

    it('fails readiness once an announced title load outlasts the grace', async () => {
        await start({ titleLoadGraceMs: 200 })
        const load = fetch(origin + '/load-title?ms=2500')
        await vi.waitFor(() => expect(supervisor.vouchingForTitleLoad()).toBe(true))
        await new Promise((resolve) => setTimeout(resolve, 300))
        expect((await fetch(healthOrigin + '/__health/ready')).status).toBe(503)
        expect((await load).status).toBe(200)
    })

    it('bounds the recovery queue and releases canceled waiters', async () => {
        supervisor = new BackendSupervisor({
            entry: new URL('./fixtures/backend.mjs', import.meta.url)
        })
        const controller = new AbortController()
        const waiting = Array.from({ length: 500 }, () =>
            supervisor.acquireWhenReady(controller.signal)
        )
        const settled = Promise.allSettled(waiting)
        await expect(supervisor.acquireWhenReady(controller.signal)).rejects.toThrow(
            'queue is full'
        )
        controller.abort()
        expect((await settled).every((result) => result.status === 'rejected')).toBe(true)
        const next = supervisor.acquireWhenReady(AbortSignal.timeout(10))
        await expect(next).rejects.toThrow('canceled')
    })

    it('serves static assets without prematurely sending the response or crashing the child', async () => {
        await start({ fixture: 'fastifyBackend.mjs' })
        const old = await get()
        const response = await fetch(origin + '/assets/asset.js')
        expect(response.status).toBe(200)
        expect(await response.text()).toBe('console.log("loaded")')
        expect(response.headers.get('cache-control')).toBe('public,max-age=300')
        expect((await get()).pid).toBe(old.pid)
    })

    it('rejects a missing Host header without losing the public listener', async () => {
        await start()
        const old = await get()
        const address = gateway.server.address()
        if (!address || typeof address === 'string') throw new Error('No listener')
        const socket = connect(address.port, '127.0.0.1')
        let response = ''
        socket.setEncoding('utf8')
        socket.on('data', (chunk) => {
            response += chunk
        })
        await once(socket, 'connect')
        socket.end('GET / HTTP/1.0\r\n\r\n')
        await once(socket, 'close')
        expect(response).toContain('400 Bad Request')
        expect((await get()).pid).toBe(old.pid)
    })

    it('contains a synchronous forwarding error and releases the request', async () => {
        await start()
        const release = vi.fn()
        const acquire = vi.spyOn(supervisor, 'acquire').mockReturnValue({ port: 65536, release })
        try {
            expect((await fetch(origin)).status).toBe(502)
            expect(release).toHaveBeenCalledOnce()
        } finally {
            acquire.mockRestore()
        }
        expect((await fetch(origin)).status).toBe(200)
    })

    it.each([false, true])(
        'finishes a disconnected mutation during shutdown (throws=%s)',
        async (fail) => {
            await start({ fixture: 'fastifyBackend.mjs' })
            const old = await get()
            const controller = new AbortController()
            const request = fetch(origin + `/mutation?fail=${fail ? 'yes' : ''}`, {
                method: 'POST',
                signal: controller.signal
            }).catch(() => undefined)
            await vi.waitFor(async () =>
                expect(await events()).toContainEqual({ event: 'mutation-started', pid: old.pid })
            )
            controller.abort()
            await request
            await supervisor.close()
            await expectExited(old.pid)
            const history = await events()
            const completed = history.findIndex(
                (event) => event.pid === old.pid && event.event === 'mutation-completed'
            )
            const exited = history.findIndex(
                (event) => event.pid === old.pid && event.event === 'exited'
            )
            expect(completed).toBeGreaterThan(-1)
            expect(completed).toBeLessThan(exited)
        }
    )

    it('waits for handler work after an early response before exiting', async () => {
        await start({ fixture: 'fastifyBackend.mjs' })
        const old = await get()
        await fetch(origin + '/mutation?early=yes', { method: 'POST' })
        await supervisor.close()
        await expectExited(old.pid)
        expect(await events()).toContainEqual({ event: 'mutation-completed', pid: old.pid })
    })

    it('still enforces the deadline on unfinished handler work', async () => {
        await start({ drainTimeoutMs: 100, fixture: 'fastifyBackend.mjs' })
        const old = await get()
        await fetch(origin + '/mutation?early=yes&ms=5000', { method: 'POST' })
        await supervisor.close()
        await expectExited(old.pid)
        expect(await events()).not.toContainEqual({ event: 'mutation-completed', pid: old.pid })
    })

    it('closes a child that is still starting when shutdown happens during recovery', async () => {
        await start()
        const old = await get()
        await writeFile(config, JSON.stringify({ startupDelay: 200 }))
        expect((await fetch(origin + '/crash')).status).toBe(502)
        await vi.waitFor(async () =>
            expect((await events()).filter((event) => event.event === 'started')).toHaveLength(2)
        )
        const pids = (await events())
            .filter((event) => event.event === 'started')
            .map((event) => event.pid)
        await supervisor.close()
        for (const pid of pids) await expectExited(pid)
        expect(supervisor.acquire()).toBeUndefined()
        expect(pids).toContain(old.pid)
    })

    it('retries a failed start until a worker comes up', async () => {
        await start()
        const old = await get()
        await writeFile(config, JSON.stringify({ fail: true }))
        expect((await fetch(origin + '/crash')).status).toBe(502)
        await vi.waitFor(async () =>
            expect(
                (await events()).filter((event) => event.event === 'exited').length
            ).toBeGreaterThan(1)
        )
        await writeFile(config, '{}')
        await vi.waitFor(async () => expect((await get()).pid).not.toBe(old.pid), {
            timeout: 3_000
        })
    })

    it('bounds a stalled start and keeps retrying', async () => {
        await start()
        const old = await get()
        await writeFile(config, JSON.stringify({ hang: true }))
        expect((await fetch(origin + '/crash')).status).toBe(502)
        await vi.waitFor(async () =>
            expect((await events()).filter((event) => event.event === 'started')).toHaveLength(2)
        )
        const candidate = (await events()).filter((event) => event.event === 'started')[1]
        await expectExited(candidate.pid)
        await writeFile(config, '{}')
        await vi.waitFor(async () => expect((await get()).pid).not.toBe(old.pid), {
            timeout: 3_000
        })
    })

    it('bounds draining for an open event stream', async () => {
        await start({ drainTimeoutMs: 150 })
        const response = await fetch(origin + '/stream')
        const reader = response.body?.getReader()
        expect((await reader?.read())?.done).toBe(false)
        await supervisor.close()
        await expect(reader?.read()).rejects.toThrow()
    })

    it('replaces a crashed serving child without replaying the failed request', async () => {
        await start()
        const old = await get()
        expect((await fetch(origin + '/crash')).status).toBe(502)
        await vi.waitFor(async () => expect((await get()).pid).not.toBe(old.pid))
    })

    it('forwards HTTP/2 bodies, headers, cookies and reuses the public session after recovery', async () => {
        await start({ http2Enabled: true })
        const client = http2.connect(origin)
        try {
            const request = client.request({
                ':path': '/echo?x=1',
                ':method': 'POST',
                authorization: 'Bearer test',
                'content-type': 'application/json',
                'x-forwarded-for': 'forged'
            })
            let responseHeaders: http2.IncomingHttpHeaders = {}
            request.on('response', (headers) => {
                responseHeaders = headers
            })
            request.setEncoding('utf8')
            let body = ''
            request.on('data', (chunk) => {
                body += chunk
            })
            request.end('{"value":1}')
            await once(request, 'end')
            const result = JSON.parse(body)
            expect(result.body).toBe('{"value":1}')
            expect(result.url).toBe('/echo?x=1')
            expect(result.headers.authorization).toBe('Bearer test')
            expect(result.headers['x-forwarded-for']).toBe('127.0.0.1')
            expect(responseHeaders['set-cookie']).toEqual(['one=1', 'two=2'])
            const oldPort = supervisor.port
            const crash = client.request({ ':path': '/crash' })
            crash.resume()
            crash.end()
            await once(crash, 'end')
            await vi.waitFor(() => expect(supervisor.port).not.toBe(oldPort))
            const next = client.request({ ':path': '/' })
            let nextBody = ''
            next.setEncoding('utf8')
            next.on('data', (chunk) => {
                nextBody += chunk
            })
            next.end()
            await once(next, 'end')
            expect(JSON.parse(nextBody).pid).not.toBe(result.pid)
        } finally {
            client.destroy()
        }
    })
})
