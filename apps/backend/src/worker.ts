import Fastify from 'fastify'
import rawBody from 'fastify-raw-body'
import { app } from './app/app.js'
import { installHandlerDrain } from './runtime/handlerDrain.js'
import { ajvOptions } from './runtime/ajvOptions.js'
import { lazyValidatorCompiler } from './runtime/lazyValidation.js'
import type { TitleLoadMessage } from './runtime/backendChild.js'

if (!process.send) throw new Error('Backend worker requires a supervisor IPC channel')
const send = process.send.bind(process)

function announce(message: TitleLoadMessage): Promise<void> {
    return new Promise((resolve, reject) =>
        send(message, undefined, undefined, (error) => (error ? reject(error) : resolve()))
    )
}

async function whileLoadingTitle<T>(load: () => Promise<T>): Promise<T> {
    await announce({ titleLoad: 'started' })
    try {
        return await load()
    } finally {
        await announce({ titleLoad: 'finished' })
    }
}

const server = Fastify({
    logger: true,
    trustProxy: '127.0.0.1',
    ajv: ajvOptions,
    // The supervisor bounds startup; a replacement starting beside a serving child on a
    // throttled CPU can take far longer than a fresh instance.
    pluginTimeout: 0
})
server.setValidatorCompiler(lazyValidatorCompiler(() => server.getSchemas(), ajvOptions))
installHandlerDrain(server)
server.get('/__health/ready', () => ({ status: 'ready' }))
let closing = false
const shutdown = async () => {
    if (closing) return
    closing = true
    try {
        await server.close()
        process.exit(0)
    } catch (error) {
        console.error('Backend shutdown failed', error)
        process.exit(1)
    }
}
process.on('SIGTERM', () => void shutdown())
process.on('SIGINT', () => void shutdown())
process.on('disconnect', () => process.exit(1))

try {
    await server.register(rawBody, { global: false, runFirst: true })
    await server.register(app, { whileLoadingTitle })
    await server.listen({ port: 0, host: '127.0.0.1' })
    const address = server.server.address()
    if (!address || typeof address === 'string') throw new Error('Backend has no TCP address')
    send({ port: address.port })
} catch (error) {
    console.error('Backend startup failed', error)
    process.exit(1)
}
