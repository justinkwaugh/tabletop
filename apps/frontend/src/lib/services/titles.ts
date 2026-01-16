import type { GameState, HydratedGameState } from '@tabletop/common'
import type { GameUiDefinition } from '@tabletop/frontend-components'
import { Games } from '@tabletop/games-config'

const definitions: GameUiDefinition<GameState, HydratedGameState>[] = []
for (const game of Games) {
    try {
        const url = new URL(/* @vite-ignore */ `/games/${game.id}/index.js`, import.meta.url)
        let gameModule = await import(url.href)
        if (!gameModule) {
            throw new Error()
        }
        const gameDefinition = gameModule[
            `UiDefinition` as keyof typeof gameModule
        ] as GameUiDefinition<GameState, HydratedGameState>
        definitions.push(gameDefinition)
    } catch (e) {
        console.log(`Could not load game module for ${game.id} at ${game.version} from ${game.id}`)
    }
}

// create a record of definitions keyed by their id for each definition in definitions
export const AVAILABLE_TITLES: Record<
    string,
    GameUiDefinition<GameState, HydratedGameState>
> = Object.fromEntries(definitions.map((definition) => [definition.id, definition]))
