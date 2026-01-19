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

const manifest = await loadManifest()
export const FRONTEND_VERSION =
    manifest.frontend?.version ?? SiteManifest.frontend?.version ?? '0.0.0'
const games = manifest.games
export const GAME_UI_VERSIONS: Record<string, string> = Object.fromEntries(
    games.map((game) => [game.gameId, game.uiVersion])
)

const definitions: GameUiDefinition<GameState, HydratedGameState>[] = []
for (const game of games) {
    try {
        const url = new URL(
            /* @vite-ignore */ `/games/${game.packageId}/ui/${game.uiVersion}/index.js`,
            import.meta.url
        )
        let gameModule = await import(url.href)
        if (!gameModule) {
            throw new Error()
        }
        const gameDefinition = gameModule[
            `UiDefinition` as keyof typeof gameModule
        ] as GameUiDefinition<GameState, HydratedGameState>
        definitions.push(gameDefinition)
    } catch (e) {
        console.log(
            `Could not load game module for ${game.gameId} (${game.packageId}) at ${game.uiVersion}`
        )
    }
}

// create a record of definitions keyed by their id for each definition in definitions
export const AVAILABLE_TITLES: Record<
    string,
    GameUiDefinition<GameState, HydratedGameState>
> = Object.fromEntries(definitions.map((definition) => [definition.info.id, definition]))
