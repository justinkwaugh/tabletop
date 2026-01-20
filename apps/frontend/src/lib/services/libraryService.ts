import { type GameUiDefinition } from '@tabletop/frontend-components'
import { GameState, Role, User, type HydratedGameState } from '@tabletop/common'
import { Manifest, GAME_UI_VERSIONS } from './manifestService.js'

const definitions: GameUiDefinition<GameState, HydratedGameState>[] = []
for (const game of Manifest.games) {
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

export class LibraryService {
    private readonly titles = Object.fromEntries(
        definitions.map((definition) => [definition.info.id, definition])
    )

    constructor() {}

    getTitles(user: User): GameUiDefinition<GameState, HydratedGameState>[] {
        return Object.values(this.titles)
            .filter(
                (title) =>
                    !title.info.metadata.beta ||
                    (user &&
                        (user.roles.includes(Role.Admin) || user.roles.includes(Role.BetaTester)))
            )
            .sort((a, b) => a.info.metadata.name.localeCompare(b.info.metadata.name))
    }

    getTitle(id: string): GameUiDefinition<GameState, HydratedGameState> | undefined {
        return this.titles[id]
    }

    getUiVersionForTitle(id: string): string | undefined {
        return GAME_UI_VERSIONS[id]
    }

    getNameForTitle(id: string): string {
        return this.titles[id]?.info.metadata.name ?? 'Unknown Game'
    }

    getThumbnailForTitle(id: string): string {
        return this.titles[id]?.info.thumbnailUrl ?? ''
    }
}
