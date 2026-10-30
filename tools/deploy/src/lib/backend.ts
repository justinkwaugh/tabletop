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

export type BackendAdminCredentials =
    | { method: 'cookie'; cookie: string }
    | { method: 'password'; username: string; password: string }

const BACKEND_ADMIN_MIGRATION =
    'The backend no longer accepts token login (security audit S06). Sign the deploy tool in with ' +
    'backendAdmin.username and backendAdmin.password (TABLETOP_BACKEND_ADMIN_USER and ' +
    'TABLETOP_BACKEND_ADMIN_PASSWORD) or an existing session cookie (backendAdmin.cookie or ' +
    'TABLETOP_BACKEND_ADMIN_COOKIE), and remove the token setting.'

// Resolved before any publication starts, so a missing or unsupported credential is found
// before anything is uploaded.
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
        'Missing backend admin credentials for cache invalidation: configure backendAdmin.username and password, or backendAdmin.cookie ' +
            '(TABLETOP_BACKEND_ADMIN_USER and TABLETOP_BACKEND_ADMIN_PASSWORD, or TABLETOP_BACKEND_ADMIN_COOKIE)'
    )
}

export const describeIgnoredBackendAdminSettings = (
    backendAdmin: BackendAdminConfig | undefined
): string | undefined => {
    const unsupported = backendAdmin?.unsupportedSettings ?? []
    if (unsupported.length === 0) return undefined
    return `${unsupported.join(' and ')} ${unsupported.length === 1 ? 'is' : 'are'} ignored: ${BACKEND_ADMIN_MIGRATION}`
}

// Manifest invalidation is administrative, so the backend requires the session to be in Admin
// Mode, which it enters only with Recent Authentication: a sign-in by the tool, or a provided
// cookie whose session signed in within the last 15 minutes.
type AdminSession = { cookie: string; origin: 'cookie' | 'login'; release: () => Promise<void> }

const openAdminSession = async (
    apiRoot: string,
    credentials: BackendAdminCredentials,
    signal?: AbortSignal
): Promise<AdminSession> => {
    if (credentials.method === 'cookie') {
        return { cookie: credentials.cookie, origin: 'cookie', release: async () => {} }
    }
    const cookie = await loginWithCredentials(
        apiRoot,
        credentials.username,
        credentials.password,
        signal
    )
    return { cookie, origin: 'login', release: () => logout(apiRoot, cookie, signal) }
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

export type InvalidationOptions = {
    signal?: AbortSignal
    warn?: (message: string) => void
    expectedPublication?: string
}

export const invalidateBackendManifestCache = async (
    config: DeployConfig,
    options?: InvalidationOptions
) => {
    const adminUrl = resolveAdminInvalidateUrl(config)
    if (!adminUrl) {
        throw new Error('Missing backend admin URL for manifest invalidation')
    }
    const credentials = resolveBackendAdminCredentials(config.backendAdmin)
    const apiRoot = resolveApiRoot(config)
    if (!apiRoot) {
        throw new Error('Missing backend API base for admin sign-in')
    }
    const session = await openAdminSession(apiRoot, credentials, options?.signal)
    try {
        await activateAdminMode(apiRoot, session, options?.signal)
        return await requestInvalidation(adminUrl, session.cookie, options)
    } finally {
        await session.release().catch((error: unknown) => {
            const warn = options?.warn ?? console.warn
            warn(
                `backend sign-out failed (${error instanceof Error ? error.message : String(error)}); Admin Mode ends within 15 minutes, but the session may remain active until it is revoked or expires`
            )
        })
    }
}

const requestInvalidation = async (
    adminUrl: string,
    cookie: string,
    options?: Pick<InvalidationOptions, 'signal' | 'expectedPublication'>
) => {
    const response = await fetch(adminUrl, {
        method: 'POST',
        headers: { accept: 'application/json', cookie },
        signal: options?.signal
    })
    if (!response.ok) {
        throw new Error(describeRefusal('manifest invalidate', await readRefusal(response)))
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
