import * as http from 'node:http'
import type { BackendSupervisor } from './backendSupervisor.js'

export async function probeBackend(supervisor: BackendSupervisor): Promise<boolean> {
    const target = supervisor.acquire()
    if (!target) return false
    try {
        return await new Promise<boolean>((resolve) => {
            const request = http.get(
                {
                    hostname: '127.0.0.1',
                    port: target.port,
                    path: '/__health/ready',
                    agent: false,
                    timeout: 1_000
                },
                (response) => {
                    response.on('error', () => resolve(false))
                    response.on('end', () => resolve(response.statusCode === 200))
                    response.resume()
                }
            )
            request.on('timeout', () => request.destroy())
            request.on('error', () => resolve(false))
        })
    } catch {
        return false
    } finally {
        target.release()
    }
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
