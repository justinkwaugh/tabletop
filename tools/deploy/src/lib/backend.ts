import { BackendManifest } from './types.js'

export type BackendManifestResult = {
    manifest?: BackendManifest
    error?: string
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
        const data = (await response.json()) as BackendManifest
        if (!data?.frontend || !data?.games) {
            return { error: 'backend manifest missing frontend/games' }
        }
        return { manifest: data }
    } catch (error) {
        return { error: error instanceof Error ? error.message : 'backend manifest fetch failed' }
    }
}
