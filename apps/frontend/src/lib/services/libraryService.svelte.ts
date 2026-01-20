import { type GameUiDefinition } from '@tabletop/frontend-components'
import { GameState, Role, User, type HydratedGameState } from '@tabletop/common'
import type { ManifestService } from './manifestService.js'

export class LibraryService {
    titlesById: Record<string, GameUiDefinition<GameState, HydratedGameState>> = $state({})
    loading = $state(true)
    private readonly loadPromise: Promise<void>

    constructor(private readonly manifestService: ManifestService) {
        this.loadPromise = this.loadDefinitions()
    }

    async whenReady(): Promise<void> {
        await this.loadPromise
    }

    getTitles(user: User): GameUiDefinition<GameState, HydratedGameState>[] {
        return Object.values(this.titlesById)
            .filter(
                (title) =>
                    !title.info.metadata.beta ||
                    (user &&
                        (user.roles.includes(Role.Admin) || user.roles.includes(Role.BetaTester)))
            )
            .sort((a, b) => a.info.metadata.name.localeCompare(b.info.metadata.name))
    }

    getTitle(id: string): GameUiDefinition<GameState, HydratedGameState> | undefined {
        return this.titlesById[id]
    }

    getUiVersionForTitle(id: string): string | undefined {
        return this.manifestService.getUiVersion(id)
    }

    getNameForTitle(id: string): string {
        return this.titlesById[id]?.info.metadata.name ?? 'Unknown Game'
    }

    getThumbnailForTitle(id: string): string {
        return this.titlesById[id]?.info.thumbnailUrl ?? ''
    }

    private async loadDefinitions() {
        try {
            const manifest = await this.manifestService.whenReady()
            const definitions: GameUiDefinition<GameState, HydratedGameState>[] = []

            for (const game of manifest.games) {
                try {
                    const url = new URL(
                        /* @vite-ignore */ `/games/${game.packageId}/ui/${game.uiVersion}/index.js`,
                        import.meta.url
                    )
                    const gameModule = await import(url.href)
                    const gameDefinition = gameModule[
                        `UiDefinition` as keyof typeof gameModule
                    ] as GameUiDefinition<GameState, HydratedGameState> | undefined
                    if (!gameDefinition) {
                        throw new Error('Missing UiDefinition export')
                    }
                    definitions.push(gameDefinition)
                } catch (error) {
                    console.log(
                        `Could not load game module for ${game.gameId} (${game.packageId}) at ${game.uiVersion}`
                    )
                }
            }

            this.titlesById = Object.fromEntries(
                definitions.map((definition) => [definition.info.id, definition])
            )
        } finally {
            this.loading = false
        }
    }
}
