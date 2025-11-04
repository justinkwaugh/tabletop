import { GameDefinition } from '@tabletop/common'
import { games } from '@tabletop/games-config'

const definitions: GameDefinition[] = []
for (const game of games) {
    const gameModule = await import(`@tabletop/${game}`)
    const gameDefinition = gameModule[`Definition` as keyof typeof gameModule] as GameDefinition
    definitions.push(gameDefinition)
}

// create a record of definitions keyed by their id for each definition in definitions
export const AVAILABLE_TITLES: Record<string, GameDefinition> = Object.fromEntries(
    definitions.map((definition) => [definition.id, definition])
)
