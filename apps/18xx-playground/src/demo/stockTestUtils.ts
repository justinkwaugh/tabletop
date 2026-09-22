import type { GameDefinition } from '@tabletop/common'
import { exampleGame, type ScenarioPosition } from '@tabletop/18xx/scenarios'
import { scenarioDefinition } from '../scenarios/definitions.js'
export { purchase } from '@tabletop/18xx/scenarios'

export function example(
    title: Pick<GameDefinition, 'info'>,
    examplePosition?: ScenarioPosition,
    playerCount?: number,
    seed?: number
) {
    return exampleGame(scenarioDefinition(title.info.id), examplePosition, playerCount, seed)
}
