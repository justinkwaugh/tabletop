import { BackendManifest } from './types.js'

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
