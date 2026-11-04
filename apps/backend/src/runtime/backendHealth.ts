import * as http from 'node:http'
import type { BackendSupervisor } from './backendSupervisor.js'

// Containment, not a fix: loading a title's logic blocks the worker's event loop for seconds,
// and Cloud Run answers a single missed readiness probe by starting another instance. Until the
// load stops blocking, the supervisor vouches for a worker that announced one, including a probe
// that was already waiting when the announcement arrived.
export async function probeBackend(supervisor: BackendSupervisor): Promise<boolean> {
    if (supervisor.vouchingForTitleLoad()) return true
    return (await probeWorker(supervisor)) || supervisor.vouchingForTitleLoad()
}

const READY_WITHIN_MS = 1_000
const STALL_GIVE_UP_MS = 60_000

// Readiness is answered after a second, but the probe keeps waiting for the worker so the
// `worker_stall` line records how long the stall lasted.
function probeWorker(supervisor: BackendSupervisor): Promise<boolean> {
    const target = supervisor.acquire()
    if (!target) return Promise.resolve(false)
    const startedAt = performance.now()
    return new Promise<boolean>((resolve) => {
        const late = setTimeout(() => resolve(false), READY_WITHIN_MS)
        let settled = false
        const settle = (ready: boolean) => {
            if (settled) return
            settled = true
            clearTimeout(late)
            resolve(ready)
            target.release()
            const waitedMs = Math.round(performance.now() - startedAt)
            if (waitedMs >= READY_WITHIN_MS) logWorkerStall(waitedMs, ready)
        }
        const request = http.get(
            {
                hostname: '127.0.0.1',
                port: target.port,
                path: '/__health/ready',
                agent: false,
                timeout: STALL_GIVE_UP_MS
            },
            (response) => {
                response.on('error', () => settle(false))
                response.on('end', () => settle(response.statusCode === 200))
                response.resume()
            }
        )
        request.on('timeout', () => request.destroy())
        request.on('error', () => settle(false))
    })
}

function logWorkerStall(waitedMs: number, answered: boolean): void {
    console.log(
        JSON.stringify({
            severity: 'WARNING',
            event: 'worker_stall',
            message: answered
                ? `Backend worker answered its health check after ${waitedMs} ms`
                : `Backend worker did not answer its health check within ${waitedMs} ms`,
            waitedMs,
            answered
        })
    )
}

export function createBackendHealthServer(
    supervisor: BackendSupervisor,
    ingressListening: () => boolean
) {
    return http.createServer(async (request, response) => {
        response.setHeader('cache-control', 'no-store')
        if (request.url !== '/__health/ready') response.statusCode = 404
        else
            response.statusCode = ingressListening() && (await probeBackend(supervisor)) ? 200 : 503
        response.end()
    })
}
