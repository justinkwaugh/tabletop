import type { FastifyRequest } from 'fastify'
import { stdSerializers, type LoggerOptions } from 'pino'

const REDACTED = '[redacted]'
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
const URL_KEYS = ['url', 'href']

function isCredentialKey(key: string): boolean {
    return CREDENTIAL_KEYS.includes(key.toLowerCase())
}

function isCredentialUrlParameter(name: string): boolean {
    return CREDENTIAL_URL_PARAMETERS.includes(name.toLowerCase())
}

export function loggableUrl(request: Pick<FastifyRequest, 'url' | 'params'>): string {
    const separator = request.url.indexOf('?')
    const path = separator < 0 ? request.url : request.url.slice(0, separator)
    const query = separator < 0 ? undefined : request.url.slice(separator + 1)
    const concealedPath = concealPathParameters(path, credentialParameterValues(request.params))
    return query === undefined ? concealedPath : `${concealedPath}?${concealQuery(query)}`
}

export function concealUrlQuery(url: string): string {
    const separator = url.indexOf('?')
    return separator < 0
        ? url
        : `${url.slice(0, separator)}?${concealQuery(url.slice(separator + 1))}`
}

function credentialParameterValues(params: unknown): string[] {
    if (typeof params !== 'object' || params === null) {
        return []
    }
    return Object.entries(params)
        .filter(([key, value]) => isCredentialKey(key) && typeof value === 'string')
        .map(([, value]) => String(value))
}

function concealPathParameters(path: string, credentials: string[]): string {
    if (credentials.length === 0) {
        return path
    }
    return path
        .split('/')
        .map((segment) => (credentials.includes(decodedSegment(segment)) ? REDACTED : segment))
        .join('/')
}

function decodedSegment(segment: string): string {
    try {
        return decodeURIComponent(segment)
    } catch {
        return segment
    }
}

function concealQuery(query: string): string {
    return [...new URLSearchParams(query)]
        .map(([name, value]) =>
            isCredentialUrlParameter(name)
                ? `${encodeURIComponent(name)}=${REDACTED}`
                : `${encodeURIComponent(name)}=${encodeURIComponent(value)}`
        )
        .join('&')
}

function loggableRequest(request: FastifyRequest) {
    return {
        method: request.method,
        url: loggableUrl(request),
        host: request.host,
        remoteAddress: request.ip,
        remotePort: request.socket?.remotePort
    }
}

function loggableError(error: Error): unknown {
    return concealValue(stdSerializers.err(error), new WeakSet(), 0)
}

function concealValue(value: unknown, seen: WeakSet<object>, depth: number): unknown {
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
        return concealValue(stdSerializers.err(value), seen, depth)
    }
    if (Array.isArray(value)) {
        return value.map((entry) => concealValue(entry, seen, depth + 1))
    }
    return Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [key, concealEntry(key, entry, seen, depth)])
    )
}

function concealEntry(key: string, value: unknown, seen: WeakSet<object>, depth: number): unknown {
    if (isCredentialKey(key)) {
        return REDACTED
    }
    if (URL_KEYS.includes(key.toLowerCase()) && typeof value === 'string') {
        return concealUrlQuery(value)
    }
    return concealValue(value, seen, depth + 1)
}

// Requests, replies and errors reach their serializers intact; the request and error serializers
// conceal credentials themselves and the reply serializer keeps only the status code.
const SERIALIZED_KEYS = ['req', 'res', 'err']

function concealLogObject(object: Record<string, unknown>): Record<string, unknown> {
    const seen = new WeakSet<object>()
    return Object.fromEntries(
        Object.entries(object).map(([key, value]) => [
            key,
            SERIALIZED_KEYS.includes(key) ? value : concealEntry(key, value, seen, 0)
        ])
    )
}

export const loggerOptions: LoggerOptions = {
    serializers: {
        req: loggableRequest,
        err: loggableError
    },
    formatters: {
        log: concealLogObject
    }
}
