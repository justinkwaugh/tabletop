import Fastify from 'fastify'
import rawBody from 'fastify-raw-body'
import { Visibility } from '@tabletop/common'
import { app } from './app/app.js'
import { installHandlerDrain } from './runtime/handlerDrain.js'

if (!process.send) throw new Error('Backend worker requires a supervisor IPC channel')
const send = process.send.bind(process)

const server = Fastify({
    logger: true,
    trustProxy: '127.0.0.1',
    ajv: { customOptions: { keywords: [Visibility.MetadataKey, Visibility.ScopeKey] } },
    pluginTimeout: 20_000
})
installHandlerDrain(server)
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
    await server.register(app, { requestRestart: () => send('reload') })
    await server.listen({ port: 0, host: '127.0.0.1' })
    const address = server.server.address()
    if (!address || typeof address === 'string') throw new Error('Backend has no TCP address')
    send({ port: address.port })
} catch (error) {
    console.error('Backend startup failed', error)
    process.exit(1)
}
