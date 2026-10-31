import { isObject } from './json.js'
import { BackendAdminConfig, BackendManifest, DeployConfig } from './types.js'

export type BackendManifestResult = {
    manifest?: BackendManifest
    servedFrontendVersion?: string
    error?: string
}

type ManifestEnvelope = {
    status?: string
    payload?: unknown
    message?: string
}

const isBackendManifest = (value: unknown): value is BackendManifest => {
    if (!isObject(value)) return false
    return isObject(value.frontend) && Array.isArray(value.games)
}

const unwrapManifest = (data: unknown): BackendManifest | null => {
    if (isBackendManifest(data)) return data
    if (!isObject(data)) return null
    const envelope = data as ManifestEnvelope
    if (envelope.status !== 'ok') return null
    return isBackendManifest(envelope.payload) ? envelope.payload : null
}

export const fetchBackendManifest = async (
    manifestUrl?: string
): Promise<BackendManifestResult> => {
    if (!manifestUrl) return {}

    try {
        const response = await fetch(manifestUrl, { headers: { accept: 'application/json' } })
        if (!response.ok) {
            return { error: `backend manifest ${response.status} ${response.statusText}` }
        }
        const data = (await response.json()) as unknown
        const manifest = unwrapManifest(data)
        if (!manifest) {
            if (isObject(data) && typeof data.message === 'string') {
                return { error: data.message }
            }
            return { error: 'backend manifest missing frontend/games' }
        }
        const servedFrontendVersion = response.headers.get('x-tabletop-version') ?? undefined
        return { manifest, servedFrontendVersion }
    } catch (error) {
        return { error: error instanceof Error ? error.message : 'backend manifest fetch failed' }
    }
}

const resolveAdminInvalidateUrl = (config: DeployConfig): string | null => {
    if (config.backendAdmin?.url) return config.backendAdmin.url
    if (!config.backendManifestUrl) return null
    try {
        const url = new URL(config.backendManifestUrl)
        url.pathname = '/api/v1/admin/manifest/invalidate'
        url.search = ''
        url.hash = ''
        return url.toString()
    } catch {
        return null
    }
}

const resolveApiRoot = (config: DeployConfig): string | null => {
    const base = config.backendAdmin?.url ?? config.backendManifestUrl
    if (!base) return null
    try {
        const url = new URL(base)
        return url.origin
    } catch {
        return null
    }
}

const getSetCookieHeaders = (response: Response): string[] => {
    const headers = response.headers as typeof response.headers & {
        getSetCookie?: () => string[]
    }
    if (typeof headers.getSetCookie === 'function') {
        return headers.getSetCookie()
    }
    const raw = response.headers.get('set-cookie')
    return raw ? [raw] : []
}

const extractCookieHeader = (setCookieHeaders: string[]): string | null => {
    const cookies = setCookieHeaders.map((header) => header.split(';')[0]?.trim()).filter(Boolean)
    if (cookies.length === 0) return null
    return cookies.join('; ')
}

const loginWithCredentials = async (
    apiRoot: string,
    username: string,
    password: string,
    signal?: AbortSignal
) => {
    const url = new URL('/api/v1/auth/login', apiRoot)
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ username, password }),
        signal
    })
    if (!response.ok) {
        throw new Error(`backend login ${response.status} ${response.statusText}`)
    }
    const cookie = extractCookieHeader(getSetCookieHeaders(response))
    if (!cookie) {
        throw new Error('backend login missing session cookie')
    }
    return cookie
}

export type BackendAdminCredentials =
    | { method: 'cookie'; cookie: string }
    | { method: 'password'; username: string; password: string }

const BACKEND_ADMIN_MIGRATION =
    'The backend no longer accepts token login (security audit S06). Sign the deploy tool in with ' +
    'backendAdmin.username and backendAdmin.password (TABLETOP_BACKEND_ADMIN_USER and ' +
    'TABLETOP_BACKEND_ADMIN_PASSWORD) or an existing session cookie (backendAdmin.cookie or ' +
    'TABLETOP_BACKEND_ADMIN_COOKIE), and remove the token setting.'

export const resolveBackendAdminCredentials = (
    backendAdmin: BackendAdminConfig | undefined
): BackendAdminCredentials => {
    if (backendAdmin?.cookie) {
        return { method: 'cookie', cookie: backendAdmin.cookie }
    }
    if (backendAdmin?.username && backendAdmin?.password) {
        return {
            method: 'password',
            username: backendAdmin.username,
            password: backendAdmin.password
        }
    }
    const unsupported = backendAdmin?.unsupportedSettings ?? []
    if (unsupported.length > 0) {
        throw new Error(
            `Backend admin credentials are given only as ${unsupported.join(' and ')}, which the ` +
                `deploy tool no longer supports. ${BACKEND_ADMIN_MIGRATION}`
        )
    }
    throw new Error(
        'Missing backend admin credentials for cache invalidation (set backendAdmin.username and ' +
            'backendAdmin.password, or TABLETOP_BACKEND_ADMIN_COOKIE)'
    )
}

export const describeIgnoredBackendAdminSettings = (
    backendAdmin: BackendAdminConfig | undefined
): string | undefined => {
    const unsupported = backendAdmin?.unsupportedSettings ?? []
    if (unsupported.length === 0) return undefined
    return `${unsupported.join(' and ')} ${unsupported.length === 1 ? 'is' : 'are'} ignored: ${BACKEND_ADMIN_MIGRATION}`
}

const BackendReplacements = ['none', 'activated', 'superseded', 'replacement-failed'] as const
export type BackendReplacement = (typeof BackendReplacements)[number]

const isBackendReplacement = (value: unknown): value is BackendReplacement =>
    BackendReplacements.some((replacement) => replacement === value)

const backendAdminSessionCookie = async (
    config: DeployConfig,
    credentials: BackendAdminCredentials,
    signal?: AbortSignal
): Promise<string> => {
    if (credentials.method === 'cookie') return credentials.cookie
    const apiRoot = resolveApiRoot(config)
    if (!apiRoot) {
        throw new Error('Missing backend API base for login')
    }
    return loginWithCredentials(apiRoot, credentials.username, credentials.password, signal)
}

export const invalidateBackendManifestCache = async (
    config: DeployConfig,
    options?: { signal?: AbortSignal; expectedPublication?: string }
) => {
    const adminUrl = resolveAdminInvalidateUrl(config)
    if (!adminUrl) {
        throw new Error('Missing backend admin URL for manifest invalidation')
    }
    const credentials = resolveBackendAdminCredentials(config.backendAdmin)
    const cookie = await backendAdminSessionCookie(config, credentials, options?.signal)

    const response = await fetch(adminUrl, {
        method: 'POST',
        headers: { accept: 'application/json', cookie },
        signal: options?.signal
    })
    if (!response.ok) {
        throw new Error(`manifest invalidate ${response.status} ${response.statusText}`)
    }
    const body: unknown = await response.json()
    if (options?.expectedPublication !== undefined) {
        if (!isObject(body) || typeof body.publication !== 'string') {
            throw new Error(
                'Backend cannot confirm the published manifest; release the backend first'
            )
        }
        if (body.activation !== 'complete' || body.publication !== options.expectedPublication) {
            throw new Error('Backend activated a different publication than the uploaded manifest')
        }
    }
    if (
        typeof body === 'object' &&
        body !== null &&
        'activation' in body &&
        body.activation === 'complete'
    ) {
        return 'activated'
    }
    return typeof body === 'object' &&
        body !== null &&
        'replacement' in body &&
        isBackendReplacement(body.replacement)
        ? body.replacement
        : undefined
}
