import { BackendManifest, DeployConfig } from './types.js'

export type BackendManifestResult = {
    manifest?: BackendManifest
    error?: string
}

type ManifestEnvelope = {
    status?: string
    payload?: unknown
    message?: string
}

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null

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
        return { manifest }
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
    const cookies = setCookieHeaders
        .map((header) => header.split(';')[0]?.trim())
        .filter(Boolean)
    if (cookies.length === 0) return null
    return cookies.join('; ')
}

const loginWithToken = async (apiRoot: string, token: string, signal?: AbortSignal) => {
    const url = new URL('/api/v1/auth/token/login', apiRoot)
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ token }),
        signal
    })
    if (!response.ok) {
        throw new Error(`backend token login ${response.status} ${response.statusText}`)
    }
    const cookie = extractCookieHeader(getSetCookieHeaders(response))
    if (!cookie) {
        throw new Error('backend token login missing session cookie')
    }
    return cookie
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

export const invalidateBackendManifestCache = async (
    config: DeployConfig,
    options?: { signal?: AbortSignal }
) => {
    const adminUrl = resolveAdminInvalidateUrl(config)
    if (!adminUrl) {
        throw new Error('Missing backend admin URL for manifest invalidation')
    }
    const apiRoot = resolveApiRoot(config)
    const backendAdmin = config.backendAdmin
    const authCookie = backendAdmin?.cookie
    let cookie = authCookie ?? null

    if (!cookie && backendAdmin?.token) {
        if (!apiRoot) {
            throw new Error('Missing backend API base for token login')
        }
        cookie = await loginWithToken(apiRoot, backendAdmin.token, options?.signal)
    }

    if (!cookie && backendAdmin?.username && backendAdmin?.password) {
        if (!apiRoot) {
            throw new Error('Missing backend API base for login')
        }
        cookie = await loginWithCredentials(
            apiRoot,
            backendAdmin.username,
            backendAdmin.password,
            options?.signal
        )
    }

    if (!cookie) {
        throw new Error('Missing backend admin credentials for cache invalidation')
    }

    const response = await fetch(adminUrl, {
        method: 'POST',
        headers: { accept: 'application/json', cookie },
        signal: options?.signal
    })
    if (!response.ok) {
        throw new Error(`manifest invalidate ${response.status} ${response.statusText}`)
    }
}
