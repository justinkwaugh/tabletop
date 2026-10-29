import { GoogleAuth } from 'google-auth-library'
import type { SiteManifest } from '@tabletop/games-config'

export function cloudManifestReader(uri: string | undefined): () => Promise<SiteManifest> {
    if (!uri) throw new Error('SITE_MANIFEST_GCS_URI is required outside local development')
    const location = new URL(uri)
    if (location.protocol !== 'gs:' || !location.hostname || location.pathname.length < 2) {
        throw new Error('SITE_MANIFEST_GCS_URI must name a gs://bucket/object')
    }
    const url =
        `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(location.hostname)}/o/` +
        `${encodeURIComponent(decodeURIComponent(location.pathname.slice(1)))}?alt=media`
    const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/devstorage.read_only']
    })
    return async () => {
        const response = await auth.request<SiteManifest>({
            url,
            headers: { 'Cache-Control': 'no-cache' },
            timeout: 15_000
        })
        return response.data
    }
}
