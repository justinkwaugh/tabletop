import type { GameState, HydratedGameState } from '@tabletop/common'
import type { GameUiDefinition } from '@tabletop/frontend-components'
import { SiteManifest } from '@tabletop/games-config'

type ManifestResponse = typeof SiteManifest & {
    backend?: {
        buildSha?: string | null
        buildTime?: string | null
        revision?: string | null
    }
}

async function loadManifest(): Promise<ManifestResponse> {
    if (typeof window === 'undefined') {
        return SiteManifest
    }

    try {
        const response = await fetch('/manifest', { cache: 'no-store' })
        if (!response.ok) {
            throw new Error(`Failed to load /manifest: ${response.status}`)
        }
        return (await response.json()) as ManifestResponse
    } catch (error) {
        console.error('Failed to load /manifest. Falling back to local manifest.', error)
        return SiteManifest
    }
}

export const Manifest = await loadManifest()
export const FRONTEND_VERSION =
    Manifest.frontend?.version ?? SiteManifest.frontend?.version ?? '0.0.0'
const games = Manifest.games
export const GAME_UI_VERSIONS: Record<string, string> = Object.fromEntries(
    games.map((game) => [game.gameId, game.uiVersion])
)
