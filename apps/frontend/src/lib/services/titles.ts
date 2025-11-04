import type { GameUiDefinition } from '@tabletop/frontend-components'
import { games } from '@tabletop/games-config'

const definitions: GameUiDefinition[] = []
for (const game of games) {
    // This is obviously incredibly gross, but vite/rollup does not support dynamic imports
    // with variables from node_modules directly.  It has to be a relative import with a file extension
    // so we traverse all the way back up to get it.
    const gameModule = await import(
        `../../../../../node_modules/@tabletop/${game}-ui/dist/index.js`
    )
    // const gameModule = await import(`@tabletop/${game}-ui`)
    const gameDefinition = gameModule[`UiDefinition` as keyof typeof gameModule] as GameUiDefinition
    definitions.push(gameDefinition)
}

// create a record of definitions keyed by their id for each definition in definitions
export const AVAILABLE_TITLES: Record<string, GameUiDefinition> = Object.fromEntries(
    definitions.map((definition) => [definition.id, definition])
)
