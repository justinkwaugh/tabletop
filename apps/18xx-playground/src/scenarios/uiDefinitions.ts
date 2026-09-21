import type { EighteenXXState, HydratedEighteenXXState } from '@tabletop/18xx'
import type { GameUiDefinition } from '@tabletop/frontend-components'
import { scenarioDefinition } from './definitions.js'

export function withScenarioUi(
    definition: GameUiDefinition<EighteenXXState, HydratedEighteenXXState>
): GameUiDefinition<EighteenXXState, HydratedEighteenXXState> {
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
