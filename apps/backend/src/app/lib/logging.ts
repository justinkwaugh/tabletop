import type { FastifyInstance, FastifyRequest } from 'fastify'
import { stdSerializers, type LoggerOptions } from 'pino'
import { REDACTED } from '@tabletop/backend-services'

const MAX_DEPTH = 10
const CREDENTIAL_KEYS = [
    'token',
    'secret',
    'secrethash',
    'password',
    'passwordhash',
    'credential',
    'challenge',
    'cookie',
    'set-cookie',
    'authorization',
    'sessionid'
]
const CREDENTIAL_URL_PARAMETERS = [
    ...CREDENTIAL_KEYS,
    'code',
    'state',
    'access_token',
    'id_token',
    'refresh_token',
    'client_secret'
]
// Text is concealed on the serialized line, so a value ends at a JSON escape as well as at a
// URL delimiter.
const PATH_SEGMENT = '[^/?#\\s"\'&<>\\\\]+'
const AFTER_PATH = '(?=[/?#\\s"\'&<>\\\\]|$)'
const QUERY_PARAMETER = /([?&])([^=&#\s"'<>\\]+)=[^&#\s"'<>\\]*/g
const BEARER_CREDENTIAL = /\bBearer\s+[^\s"'&<>\\]+/g

// Requests, replies and errors reach their serializers intact; the request and error serializers
// conceal credentials themselves and the reply serializer keeps only the status code.
const SERIALIZED_KEYS = ['req', 'res', 'err']

function isCredentialKey(key: string): boolean {
    return CREDENTIAL_KEYS.includes(key.toLowerCase())
}

function isCredentialUrlParameter(name: string): boolean {
    return CREDENTIAL_URL_PARAMETERS.includes(name.toLowerCase())
}

function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isCredentialParameter(segment: string): boolean {
    return segment.startsWith(':') && isCredentialKey(segment.slice(1))
}

function segmentPattern(segment: string): string {
    return segment.startsWith(':') ? PATH_SEGMENT : escapeRegExp(segment)
}

export class LoggingBoundary {
    private readonly credentialPaths: RegExp[] = []
    readonly loggerOptions: LoggerOptions

    constructor() {
        this.loggerOptions = {
            serializers: {
                req: (request: FastifyRequest) => this.loggableRequest(request),
                err: (error: Error) => this.loggableError(error)
            },
            formatters: {
                log: (object) => this.concealLogObject(object)
            },
            hooks: {
                streamWrite: (line) => this.conceal(line)
            }
        }
    }

    observeRoutes(server: FastifyInstance): void {
        server.addHook('onRoute', (route) => this.addRoute(route.url))
    }

    conceal(text: string): string {
        const concealed = this.credentialPaths
            .reduce((result, path) => result.replace(path, REDACTED), text)
            .replace(QUERY_PARAMETER, (match: string, separator: string, name: string) =>
                isCredentialUrlParameter(name) ? `${separator}${name}=${REDACTED}` : match
            )
        return concealed.replace(BEARER_CREDENTIAL, `Bearer ${REDACTED}`)
    }

    private addRoute(url: string): void {
        const segments = url.split('/')
        segments.forEach((segment, index) => {
            if (!isCredentialParameter(segment)) return
            const before = segments.slice(0, index).map(segmentPattern).join('/')
            const after = segments
                .slice(index + 1)
                .map(segmentPattern)
                .join('/')
            this.credentialPaths.push(
                new RegExp(
                    `(?<=${before}/)${PATH_SEGMENT}(?=${after ? `/${after}` : ''}${AFTER_PATH})`,
                    'g'
                )
            )
        })
    }

    private loggableUrl(request: Pick<FastifyRequest, 'url' | 'params'>): string {
        const separator = request.url.indexOf('?')
        const path = separator < 0 ? request.url : request.url.slice(0, separator)
        const query = separator < 0 ? '' : request.url.slice(separator)
        const declared = this.credentialParameterValues(request.params)
        const concealedPath = path
            .split('/')
            .map((segment) =>
                declared.includes(this.decodedSegment(segment)) ? REDACTED : segment
            )
            .join('/')
        return this.conceal(`${concealedPath}${query}`)
    }

    private credentialParameterValues(params: unknown): string[] {
        if (typeof params !== 'object' || params === null) {
            return []
        }
        return Object.entries(params)
            .filter(([key, value]) => isCredentialKey(key) && typeof value === 'string')
            .map(([, value]) => String(value))
    }

    private decodedSegment(segment: string): string {
        try {
            return decodeURIComponent(segment)
        } catch {
            return segment
        }
    }

    private loggableRequest(request: FastifyRequest) {
        return {
            method: request.method,
            url: this.loggableUrl(request),
            host: request.host,
            remoteAddress: request.ip,
            remotePort: request.socket?.remotePort
        }
    }

    private loggableError(error: Error): unknown {
        return this.concealValue(stdSerializers.err(error), new WeakSet(), 0)
    }

    private concealLogObject(object: Record<string, unknown>): Record<string, unknown> {
        const seen = new WeakSet<object>()
        return Object.fromEntries(
            Object.entries(object).map(([key, value]) => [
                key,
                SERIALIZED_KEYS.includes(key) ? value : this.concealEntry(key, value, seen, 0)
            ])
        )
    }

    private concealEntry(
        key: string,
        value: unknown,
        seen: WeakSet<object>,
        depth: number
    ): unknown {
        return isCredentialKey(key) ? REDACTED : this.concealValue(value, seen, depth + 1)
    }

    private concealValue(value: unknown, seen: WeakSet<object>, depth: number): unknown {
        if (typeof value !== 'object' || value === null || value instanceof Date) {
            return value
        }
        if (seen.has(value)) {
            return '[circular]'
        }
        if (depth > MAX_DEPTH) {
            return '[omitted]'
        }
        seen.add(value)
        if (value instanceof Error) {
            return this.concealValue(stdSerializers.err(value), seen, depth)
        }
        if (Array.isArray(value)) {
            return value.map((entry) => this.concealValue(entry, seen, depth + 1))
        }
        return Object.fromEntries(
            Object.entries(value).map(([key, entry]) => [
                key,
                this.concealEntry(key, entry, seen, depth)
            ])
        )
    }
}
