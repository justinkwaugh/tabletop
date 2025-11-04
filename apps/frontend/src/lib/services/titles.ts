import type { GameUiDefinition } from '@tabletop/frontend-components'
import { AvailableGames } from '@tabletop/frontend-games'

const definitions: GameUiDefinition[] = []
for (const [name, scope] of AvailableGames) {
    // This is obviously incredibly gross, but vite/rollup does not support dynamic imports
    // with variables from node_modules directly.  It has to be a relative import with a file extension
    // so we traverse all the way back up to get it.
    let gameModule = null
    if (scope) {
        gameModule = await import(`../../../../../node_modules/${scope}/${name}-ui/dist/index.js`)
    } else {
        gameModule = await import(`../../../../../node_modules/${name}-ui/dist/index.js`)
    }

    if (!gameModule) {
        throw new Error(`Could not load game module for ${scope}/${name}`)
    }
    const gameDefinition = gameModule[`UiDefinition` as keyof typeof gameModule] as GameUiDefinition
    definitions.push(gameDefinition)
}

// create a record of definitions keyed by their id for each definition in definitions
export const AVAILABLE_TITLES: Record<string, GameUiDefinition> = Object.fromEntries(
    definitions.map((definition) => [definition.id, definition])
)
