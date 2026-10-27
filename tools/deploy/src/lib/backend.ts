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

const JSON_HEADERS = { 'content-type': 'application/json', accept: 'application/json' }

type BackendRefusal = { status: number; statusText: string; name?: string; message?: string }

const readRefusal = async (response: Response): Promise<BackendRefusal> => {
    const refusal = { status: response.status, statusText: response.statusText }
    try {
        const body: unknown = await response.json()
        if (!isObject(body) || !isObject(body.error)) return refusal
        return {
            ...refusal,
            name: typeof body.error.name === 'string' ? body.error.name : undefined,
            message: typeof body.error.message === 'string' ? body.error.message : undefined
        }
    } catch {
        return refusal
    }
}

const describeRefusal = (step: string, refusal: BackendRefusal) =>
    `backend ${step} ${refusal.status} ${refusal.statusText}` +
    (refusal.message ? ` (${refusal.message})` : '')

const loginWithCredentials = async (
    apiRoot: string,
    username: string,
    password: string,
    signal?: AbortSignal
) => {
    const url = new URL('/api/v1/auth/login', apiRoot)
    const response = await fetch(url, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ username, password }),
        signal
    })
    if (!response.ok) {
        throw new Error(describeRefusal('login', await readRefusal(response)))
    }
    const cookie = extractCookieHeader(getSetCookieHeaders(response))
    if (!cookie) {
        throw new Error('backend login missing session cookie')
    }
    return cookie
}

const logout = async (apiRoot: string, cookie: string, signal?: AbortSignal) => {
    const url = new URL('/api/v1/auth/logout', apiRoot)
    const response = await fetch(url, { headers: { accept: 'application/json', cookie }, signal })
    if (!response.ok) {
        throw new Error(describeRefusal('logout', await readRefusal(response)))
    }
}

// Manifest invalidation is administrative, so the backend requires the session to be in Admin
// Mode, which it enters only with Recent Authentication: a sign-in by the tool, or a provided
// cookie whose session signed in within the last 15 minutes.
type AdminSession = { cookie: string; origin: 'cookie' | 'login'; release: () => Promise<void> }

const openAdminSession = async (
    apiRoot: string,
    backendAdmin: BackendAdminConfig | undefined,
    signal?: AbortSignal
): Promise<AdminSession> => {
    if (backendAdmin?.cookie) {
        return { cookie: backendAdmin.cookie, origin: 'cookie', release: async () => {} }
    }
    if (backendAdmin?.username && backendAdmin?.password) {
        const cookie = await loginWithCredentials(
            apiRoot,
            backendAdmin.username,
            backendAdmin.password,
            signal
        )
        return { cookie, origin: 'login', release: () => logout(apiRoot, cookie, signal) }
    }
    throw new Error(
        'Missing backend admin credentials for cache invalidation: configure backendAdmin.username and password, or backendAdmin.cookie'
    )
}

const describeActivationRefusal = (refusal: BackendRefusal, origin: AdminSession['origin']) => {
    const detail = describeRefusal('admin-mode activation', refusal)
    if (refusal.status === 404) {
        return `${detail}: this backend predates server-held Admin Mode; release the backend from this checkout before releasing anything else with it`
    }
    if (refusal.name === 'RecentAuthenticationRequiredError') {
        return origin === 'cookie'
            ? `${detail}: the session behind backendAdmin.cookie did not sign in within the last 15 minutes; use a fresher cookie, or configure backendAdmin.username and password so the tool signs in itself`
            : `${detail}: the sign-in did not count as Recent Authentication`
    }
    if (refusal.status === 403) {
        return `${detail}: the account is not an Administrator`
    }
    if (refusal.status === 401) {
        return `${detail}: the session is not live`
    }
    return detail
}

const activateAdminMode = async (apiRoot: string, session: AdminSession, signal?: AbortSignal) => {
    const url = new URL('/api/v1/auth/admin-mode/activate', apiRoot)
    const response = await fetch(url, {
        method: 'POST',
        headers: { accept: 'application/json', cookie: session.cookie },
        signal
    })
    if (!response.ok) {
        throw new Error(describeActivationRefusal(await readRefusal(response), session.origin))
    }
}

const BackendReplacements = ['none', 'activated', 'superseded', 'replacement-failed'] as const
export type BackendReplacement = (typeof BackendReplacements)[number]

const isBackendReplacement = (value: unknown): value is BackendReplacement =>
    BackendReplacements.some((replacement) => replacement === value)

export type InvalidationOptions = { signal?: AbortSignal; warn?: (message: string) => void }

export const invalidateBackendManifestCache = async (
    config: DeployConfig,
    options?: InvalidationOptions
) => {
    const adminUrl = resolveAdminInvalidateUrl(config)
    if (!adminUrl) {
        throw new Error('Missing backend admin URL for manifest invalidation')
    }
    const apiRoot = resolveApiRoot(config)
    if (!apiRoot) {
        throw new Error('Missing backend API base for admin sign-in')
    }
    const session = await openAdminSession(apiRoot, config.backendAdmin, options?.signal)
    try {
        await activateAdminMode(apiRoot, session, options?.signal)
        return await requestInvalidation(adminUrl, session.cookie, options?.signal)
    } finally {
        await session.release().catch((error: unknown) => {
            const warn = options?.warn ?? console.warn
            warn(
                `backend sign-out failed (${error instanceof Error ? error.message : String(error)}); Admin Mode ends within 15 minutes, but the session may remain active until it is revoked or expires`
            )
        })
    }
}

const requestInvalidation = async (adminUrl: string, cookie: string, signal?: AbortSignal) => {
    const response = await fetch(adminUrl, {
        method: 'POST',
        headers: { accept: 'application/json', cookie },
        signal
    })
    if (!response.ok) {
        throw new Error(describeRefusal('manifest invalidate', await readRefusal(response)))
    }
    const body: unknown = await response.json()
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
