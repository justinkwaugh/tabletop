import Fastify from 'fastify'
import type {
    FastifyHttp2Options,
    FastifyHttpOptions,
    FastifyInstance,
    RawServerBase
} from 'fastify'
import rawBody from 'fastify-raw-body'
import { restartable, type ApplicationFactory } from '@fastify/restartable'
import { app } from './app/app.js'
import * as http2 from 'node:http2'
import * as http from 'node:http'

const host = process.env['HOST'] ?? 'localhost'
const port = process.env['PORT'] ? Number(process.env['PORT']) : 3000

const service: string = process.env['K_SERVICE'] ?? 'local'

const registerApp = async <Server extends RawServerBase>(server: FastifyInstance<Server>) => {
    await server.register(rawBody, {
        global: false,
        runFirst: true
    })

    // Register your application as a normal plugin.
    await server.register(app)

    return server
}

const createHttpApp: ApplicationFactory<http.Server> = async (fastifyFactory, options) => {
    const server = fastifyFactory(options)

    return registerApp(server)
}

const createHttp2App: ApplicationFactory<http2.Http2Server> = async (fastifyFactory, options) => {
    const server = fastifyFactory(options)

    return registerApp(server)
}

const startServer = <Server extends RawServerBase>(server: FastifyInstance<Server>) => {
    server.listen({ port, host }, (err) => {
        if (err) {
            server.log.error(err)
            process.exit(1)
        } else {
            console.log(`[ ready ] http://${host}:${port}`)
        }
    })
}

if (service === 'backend') {
    const server = await restartable(
        createHttp2App,
        {
            http2: true,
            logger: true,
            pluginTimeout: 20000
        } as FastifyHttp2Options<http2.Http2Server>,
        Fastify
    )

    startServer(server)
} else {
    const server = await restartable(
        createHttpApp,
        {
            logger: true
        } as FastifyHttpOptions<http.Server>,
        Fastify
    )

    startServer(server)
}
