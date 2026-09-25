import { BackendSupervisor } from './runtime/backendSupervisor.js'
import { createBackendGateway } from './runtime/backendGateway.js'
import { createBackendHealthServer } from './runtime/backendHealth.js'

const supervisor = new BackendSupervisor({
    entry: new URL(import.meta.url.endsWith('.ts') ? './worker.ts' : './worker.js', import.meta.url)
})
const gateway = createBackendGateway(process.env['K_SERVICE'] === 'backend', supervisor)
const health = createBackendHealthServer(supervisor, () => gateway.server.listening)
let closing = false
async function shutdown(code: number) {
    if (closing) return
    closing = true
    health.close()
    health.closeAllConnections()
    await Promise.all([gateway.close(), supervisor.close()])
    process.exit(code)
}
process.on('SIGTERM', () => void shutdown(0))
process.on('SIGINT', () => void shutdown(0))
gateway.server.on('error', (error) => {
    console.error('Backend listener failed', error)
    void shutdown(1)
})
health.on('error', (error) => {
    console.error('Backend health listener failed', error)
    void shutdown(1)
})
try {
    health.listen({ port: 8081, host: '0.0.0.0' })
    await supervisor.start()
    if (!closing) {
        const host = process.env['HOST'] ?? 'localhost'
        const port = Number(process.env['PORT'] ?? 3000)
        gateway.server.listen({ port, host }, () => console.log(`[ ready ] http://${host}:${port}`))
    }
} catch (error) {
    console.error('Backend startup failed', error)
    await shutdown(1)
}
