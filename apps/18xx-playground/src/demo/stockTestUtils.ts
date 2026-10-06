import { assert, GameEngine, type GameDefinition, type HydratedGameState } from '@tabletop/common'
import type { EighteenXXState, HydratedEighteenXXState } from '@tabletop/18xx'
import { exampleGame, type ScenarioPosition } from '@tabletop/18xx/scenarios'
import { scenarioDefinition } from '../scenarios/definitions.js'
export { purchase } from '@tabletop/18xx/scenarios'

export function example<
    Raw extends EighteenXXState,
    State extends HydratedEighteenXXState & HydratedGameState<Raw>
>(
    title: GameDefinition<Raw, State>,
    examplePosition?: ScenarioPosition,
    playerCount?: number,
    seed?: number
) {
    const { game, state } = exampleGame(
        scenarioDefinition(title.info.id),
        examplePosition,
        playerCount,
        seed
    )
    const canonical = (data: EighteenXXState): data is Raw =>
        title.runtime.canonicalStateValidator?.Check(data) === true
    assert(canonical(state), 'Example requires the selected title’s canonical state')
    return { game, state, engine: new GameEngine(title.runtime) }
}
