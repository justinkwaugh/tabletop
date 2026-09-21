import type { GameState, HydratedGameState } from '@tabletop/common'
import type { GameUiDefinition } from '@tabletop/frontend-components'
import { scenarioDefinition } from './definitions.js'

export function withScenarioUi(
    definition: GameUiDefinition<GameState, HydratedGameState>
): GameUiDefinition<GameState, HydratedGameState> {
    const scenarios = scenarioDefinition(definition.info.id)
    return {
        ...definition,
        info: { ...definition.info, configurator: scenarios.info.configurator },
        runtime: async () => ({
            ...(await definition.runtime()),
            initializer: scenarios.runtime.initializer
        })
    }
}
