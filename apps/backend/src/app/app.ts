import { installTitleScope } from '../runtime/titleScope.js'
import { installManifestRefresh } from '../runtime/manifestRefresh.js'
import RequestTimingsPlugin from './plugins/requestTimings.js'
import { STATIC_ROOT, type LibraryServiceOptions } from '@tabletop/backend-services'
import { assertExists } from '@tabletop/common'
import * as path from 'path'
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import AutoLoad from '@fastify/autoload'
import SecureSession from '@fastify/secure-session'
import Auth from '@fastify/auth'
import cors from '@fastify/cors'
import FastifyFormbody from '@fastify/formbody'
import fastifyPrintRoutes from 'fastify-print-routes'
import fastifyStatic from '@fastify/static'
import fastifyRateLimit from '@fastify/rate-limit'
import { errorStatusCode } from './lib/errorStatusCode.js'
import { FastifySSEPlugin } from 'fastify-sse-v2'
import AuthorizationPlugin from './plugins/authorization.js'
import FirestorePlugin from './plugins/firestore.js'
import SensiblePlugin from './plugins/sensible.js'
import ServicesPlugin from './plugins/services.js'
import GamesPlugin from './plugins/games.js'
import GameAssetRedirectPlugin from './plugins/gameAssetRedirect.js'
import { routeAutoloadOptions } from './lib/routeAutoload.js'

const __dirname = import.meta.dirname

const API_VERSION = 1
const API_PREFIX = `/api/v${API_VERSION}`

const TASKS_PREFIX = '/tasks'

const service: string = process.env['K_SERVICE'] ?? 'local'
const FRONTEND_HOST = process.env['FRONTEND_HOST'] ?? ''
const GCLOUD_PROJECT = process.env['GCLOUD_PROJECT'] ?? ''
const FRONTEND_VERSION_OVERRIDE = process.env['FRONTEND_VERSION'] ?? null
const SESSION_EXPIRY_SECONDS = 30 * 24 * 60 * 60

const SESSION_KEY = process.env['SESSION_KEY']

export interface AppOptions extends Pick<LibraryServiceOptions, 'whileLoadingTitle'> {
    prefix?: string
}

async function frontendVersion(fastify: FastifyInstance): Promise<string> {
    return (
        FRONTEND_VERSION_OVERRIDE ??
        (await fastify.libraryService.getServedManifest()).frontend.version
    )
}

export async function app(fastify: FastifyInstance, opts: AppOptions) {
    await fastify.register(RequestTimingsPlugin)
    await fastify.register(fastifyPrintRoutes)
    fastify.addHook('onSend', async (request, reply, payload) => {
        if (typeof payload !== 'string' && !(payload instanceof String)) {
            return payload
        }
        const newPayload = payload.replace(/</g, '\\u003c')
        return newPayload
    })

    await fastify.register(fastifyRateLimit, {
        global: service !== 'local',
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
            void rep.code(errorStatusCode(error))
        }

        if (rep.statusCode >= 500) {
            req.log.error({ err: error }, 'Request failed')
        }

        if (!rep.sent) {
            // Fastify passes whatever was thrown; it is almost always an Error
            const thrown = error as Partial<Error> & Record<string, unknown>
            const outError = {
                // Pull all enumerable properties, supporting properties on custom Errors
                ...thrown,
                // Explicitly pull Error's non-enumerable properties
                name: thrown.name,
                message: thrown.message
            }
            await rep.send({ status: 'error', error: outError })
        }
    })

    fastify.addHook('onSend', async (_request, reply, payload) => {
        void reply.header('X-Tabletop-Version', await frontendVersion(fastify))
        return payload
    })

    await fastify.register(FastifyFormbody)

    await fastify.register(cors, {
        origin: [FRONTEND_HOST],
        credentials: true,
        methods: ['GET', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
        exposedHeaders: ['X-Tabletop-Version', 'ETag']
    })

    assertExists(SESSION_KEY, 'The backend supervisor provides SESSION_KEY')
    await fastify.register(SecureSession, {
        sessionName: 'session',
        cookieName: '__session',
        key: SESSION_KEY,
        expiry: SESSION_EXPIRY_SECONDS,
        cookie: {
            path: '/',
            httpOnly: true,
            secure: service === 'local' ? false : true,
            sameSite: service === 'local' ? false : true,
            maxAge: SESSION_EXPIRY_SECONDS
        }
    })

    await fastify.register(Auth)
    await fastify.register(FastifySSEPlugin)

    // This loads support plugins
    // console.log('Registering fastify plugins')
    // await fastify.register(AutoLoad, {
    //     dir: path.join(__dirname, 'plugins'),
    //     options: { ...opts, prefix: API_PREFIX }
    // })

    await fastify.register(AuthorizationPlugin)
    await fastify.register(SensiblePlugin)
    await fastify.register(FirestorePlugin, { projectId: GCLOUD_PROJECT })
    await fastify.register(ServicesPlugin, { whileLoadingTitle: opts.whileLoadingTitle })
    installTitleScope(fastify)

    if (service !== 'local') installManifestRefresh(fastify, [API_PREFIX, TASKS_PREFIX])

    await fastify.register(GamesPlugin, { prefix: API_PREFIX })

    if (service === 'local' || service === 'backend') {
        console.log('Registering API routes')
        await fastify.register(AutoLoad, {
            ...routeAutoloadOptions,
            dir: path.join(__dirname, 'routes/api'),
            options: { ...opts, prefix: API_PREFIX }
        })

        const setNoCacheHeaders = (reply: FastifyReply) => {
            reply.header('Cache-Control', 'no-store, max-age=0')
            reply.header('Pragma', 'no-cache')
            reply.header('Expires', '0')
        }

        const setPrecompressedHeaders = (reply: FastifyReply, pathName: string) => {
            if (pathName.endsWith('.br')) {
                reply.header('Content-Encoding', 'br')
                if (pathName.endsWith('.js.br')) {
                    reply.header('Content-Type', 'text/javascript')
                }
            }

            if (pathName.endsWith('.gz')) {
                reply.header('Content-Encoding', 'gzip')
                if (pathName.endsWith('.js.gz')) {
                    reply.header('Content-Type', 'text/javascript')
                }
            }
        }

        if (service === 'local') {
            const isUncachedFrontendFile = (pathName: string) =>
                ['.html', 'service-worker.js', '.webmanifest'].some((suffix) =>
                    [suffix, `${suffix}.br`, `${suffix}.gz`].some((name) => pathName.endsWith(name))
                )

            console.log('Registering local static handlers')
            await fastify.register(fastifyStatic, {
                root: path.join(__dirname, 'static'),
                preCompressed: true,
                cacheControl: false,
                setHeaders: (reply, pathName) => {
                    if (isUncachedFrontendFile(pathName)) {
                        setNoCacheHeaders(reply)
                    } else {
                        reply.header('Cache-Control', 'public, max-age=86400, immutable')
                    }
                    setPrecompressedHeaders(reply, pathName)
                }
            })

            fastify.get('/', async function (req, reply) {
                setNoCacheHeaders(reply)
                await reply.sendFile('index.html', { cacheControl: false })
            })

            fastify.get('/service-worker.js', async function (req, reply) {
                setNoCacheHeaders(reply)
                await reply.sendFile('service-worker.js', { cacheControl: false })
            })
        }

        await fastify.register(GameAssetRedirectPlugin)

        const gameAssetsAreImmutable = service !== 'local'

        await fastify.register(fastifyStatic, {
            root: path.join(STATIC_ROOT, 'games'),
            prefix: '/games/',
            decorateReply: false, // avoid reply.sendFile collisions
            preCompressed: true,
            cacheControl: gameAssetsAreImmutable,
            immutable: gameAssetsAreImmutable,
            maxAge: gameAssetsAreImmutable ? '365d' : 0,
            setHeaders: (reply, pathName) => {
                if (!gameAssetsAreImmutable) {
                    setNoCacheHeaders(reply)
                }

                setPrecompressedHeaders(reply, pathName)
            }
        })

        console.log('Registering 404 handlers')
        fastify.setNotFoundHandler(async (request, reply) => {
            if (request.url.startsWith(API_PREFIX) || request.url.startsWith(TASKS_PREFIX)) {
                await reply.code(404).send({ message: 'Not Found' })
            } else if (service === 'local') {
                console.log('Serving index.html for unknown frontend path:', request.url)
                setNoCacheHeaders(reply)
                await reply.sendFile('index.html', { cacheControl: false })
            } else {
                await reply.code(404).send({ message: 'Not Found' })
            }
        })
    }

    // This sets up the service to handle the task queues
    if (service === 'local' || service === 'tasks') {
        console.log('Registering Task routes')
        await fastify.register(AutoLoad, {
            ...routeAutoloadOptions,
            dir: path.join(__dirname, 'routes/tasks'),
            options: { ...opts, prefix: TASKS_PREFIX }
        })
    }

    console.log('Done setting up fastify')
}
