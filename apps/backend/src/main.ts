import Fastify from 'fastify'
import { app } from './app/app.js'
import rawBody from 'fastify-raw-body'

const host = process.env['HOST'] ?? 'localhost'
const port = process.env['PORT'] ? Number(process.env['PORT']) : 3000

const service: string = process.env['K_SERVICE'] ?? 'local'

// Instantiate Fastify with some config

if (service !== 'backend') {
    const httpServer = Fastify({
        logger: true
    })

    await httpServer.register(rawBody, {
        global: false,
        runFirst: true
    })

    // Register your application as a normal plugin.
    await httpServer.register(app)

    // Start listening.
    httpServer.listen({ port, host }, (err) => {
        if (err) {
            httpServer.log.error(err)
            process.exit(1)
        } else {
            console.log(`[ ready ] http://${host}:${port}`)
        }
    })
} else {
    const http2Server = Fastify({
        http2: true,
        logger: true
    })

    await http2Server.register(rawBody, {
        global: false,
        runFirst: true
    })

    // Register your application as a normal plugin.
    await http2Server.register(app)

    // Start listening.
    http2Server.listen({ port, host }, (err) => {
        if (err) {
            http2Server.log.error(err)
            process.exit(1)
        } else {
            console.log(`[ ready ] http://${host}:${port}`)
        }
    })
}
