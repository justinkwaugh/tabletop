import * as path from 'path'
import { FastifyInstance, FastifyRequest } from 'fastify'
import AutoLoad from '@fastify/autoload'
import SecureSession from '@fastify/secure-session'
import Auth from '@fastify/auth'
import FastifyFirebase from '@now-ims/fastify-firebase'
import cors from '@fastify/cors'
import FastifyFormbody from '@fastify/formbody'
import fastifyPrintRoutes from 'fastify-print-routes'
import fastifyStatic from '@fastify/static'
import fastifyRateLimit from '@fastify/rate-limit'
import { BaseError, ErrorCategory } from '@tabletop/common'
import { FastifySSEPlugin } from 'fastify-sse-v2'
import AuthorizationPlugin from './plugins/authorization.js'
import FirestorePlugin from './plugins/firestore.js'
import SensiblePlugin from './plugins/sensible.js'
import ServicesPlugin from './plugins/services.js'
import GamesPlugin from './plugins/games.js'

const __dirname = import.meta.dirname

// Major - Force Page Reload
// Minor - Suggest Page Reload
// Patch - No Reload Needed
const TABLETOP_VERSION = process.env['VERSION'] ?? '0.0.1'

const API_VERSION = 1
const API_PREFIX = `/api/v${API_VERSION}`

const TASKS_PREFIX = '/tasks'

const service: string = process.env['K_SERVICE'] ?? 'local'
const FRONTEND_HOST = process.env['FRONTEND_HOST'] ?? ''
const GCLOUD_PROJECT = process.env['GCLOUD_PROJECT'] ?? ''

const SESSION_SECRET = process.env['SESSION_SECRET']
    ? process.env['SESSION_SECRET']
    : 'youneedtosetthevalueintheenv.localfiletosomethingelse'
const SESSION_SALT = process.env['SESSION_SALT'] ?? ''

/* eslint-disable-next-line */
export interface AppOptions {
    prefix?: string
}

export async function app(fastify: FastifyInstance, opts: AppOptions) {
    await fastify.register(fastifyPrintRoutes)

    fastify.addHook('onSend', async (request, reply, payload) => {
        if (typeof payload !== 'string' && !(payload instanceof String)) {
            return payload
        }
        const newPayload = payload.replace(/</g, '\\u003c')
        return newPayload
    })

    await fastify.register(fastifyRateLimit, {
        global: true,
        max: (request: FastifyRequest, key: string) => {
            if (key.startsWith('user:')) {
                return 500
            }
            return 100
        },
        cache: 10000, // default 5000
        keyGenerator: (request: FastifyRequest) => {
            if (request.session.userId) {
                return `user:${request.session.userId}`
            }
            const clientIp = request.headers['fastly-client-ip'] || request.ip
            console.log('client ip: ', clientIp)
            return `ip:${clientIp}`
        },
        onExceeded: (request: FastifyRequest, key: string) => {
            console.log('REQUEST LIMIT EXCEEDED to', request.url, 'for key', key)
        }
    })

    fastify.setErrorHandler(async function (error, req, rep) {
        if (!rep.statusCode || rep.statusCode < 400) {
            if (error instanceof BaseError && error.category === ErrorCategory.Application) {
                void rep.code(400)
            } else {
                console.log('setting 500 due to error', error)
                void rep.code(500)
            }
        }

        if (!rep.sent) {
            const outError = {
                // Pull all enumerable properties, supporting properties on custom Errors
                ...error,
                // Explicitly pull Error's non-enumerable properties
                name: error.name,
                message: error.message
            }
            await rep.send({ status: 'error', error: outError })
        }
    })

    // If I do this as an async hook with await, it hangs forever... why?
    fastify.addHook('onSend', function handleCors(req, reply, payload, next) {
        void reply.header('X-Tabletop-Version', TABLETOP_VERSION)
        next()
    })

    await fastify.register(FastifyFormbody)

    await fastify.register(cors, {
        origin: [FRONTEND_HOST],
        credentials: true,
        methods: ['GET', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
        exposedHeaders: ['X-Tabletop-Version']
    })

    await fastify.register(SecureSession, {
        sessionName: 'session',
        cookieName: '__session',
        secret: SESSION_SECRET,
        salt: SESSION_SALT,
        expiry: 24 * 60 * 60 * 7,
        cookie: {
            path: '/',
            httpOnly: true,
            secure: service === 'local' ? false : true,
            sameSite: service === 'local' ? false : true,
            maxAge: 24 * 60 * 60 * 7
        }
    })

    await fastify.register(Auth)
    await fastify.register(FastifyFirebase, <FastifyFirebase.FirebaseOptions>{
        projectId: GCLOUD_PROJECT
    })
    await fastify.register(FastifySSEPlugin)

    // This loads support plugins
    // console.log('Registering fastify plugins')
    // await fastify.register(AutoLoad, {
    //     dir: path.join(__dirname, 'plugins'),
    //     options: { ...opts, prefix: API_PREFIX }
    // })

    await fastify.register(AuthorizationPlugin)
    await fastify.register(SensiblePlugin)
    await fastify.register(FirestorePlugin)
    await fastify.register(ServicesPlugin)
    await fastify.register(GamesPlugin, { prefix: API_PREFIX })

    // This sets up the service to handle the API and frontend
    if (service === 'local' || service === 'backend') {
        console.log('Registering API routes')
        // This loads all API routes
        await fastify.register(AutoLoad, {
            dir: path.join(__dirname, 'routes/api'),
            options: { ...opts, prefix: API_PREFIX }
        })

        // Serve the frontend as static files
        console.log('Registering static handlers')
        await fastify.register(fastifyStatic, {
            root: path.join(__dirname, 'static'),
            immutable: true,
            maxAge: '1d'
        })

        // Override root path to serve index.html with no caching
        fastify.get('/', async function (req, reply) {
            await reply.sendFile('index.html', { immutable: false, maxAge: 0 })
        })

        fastify.get('/service-worker.js', async function (req, reply) {
            await reply.sendFile('service-worker.js', { immutable: false, maxAge: 0 })
        })

        // Handle 404 differently for API and frontend
        console.log('Registering 404 handlers')
        fastify.setNotFoundHandler(async (request, reply) => {
            if (request.url.startsWith(API_PREFIX) || request.url.startsWith(TASKS_PREFIX)) {
                await reply.code(404).send({ message: 'Not Found' })
            } else {
                await reply.sendFile('index.html', { immutable: false, maxAge: 0 })
            }
        })
    }

    // This sets up the service to handle the task queues
    if (service === 'local' || service === 'tasks') {
        console.log('Registering Task routes')
        await fastify.register(AutoLoad, {
            dir: path.join(__dirname, 'routes/tasks'),
            options: { ...opts, prefix: TASKS_PREFIX }
        })
    }

    console.log('Done setting up fastify')
}
