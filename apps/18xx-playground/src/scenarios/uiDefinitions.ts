import type { GameDefinition, HydratedGameState } from '@tabletop/common'
import type { EighteenXXState, HydratedEighteenXXState } from '@tabletop/18xx'
import type { ScenarioPosition } from '@tabletop/18xx/scenarios'
import type { GameUiDefinition } from '@tabletop/frontend-components'
import type { Component } from 'svelte'
import FinanceExampleHost from '../demo/FinanceExampleHost.svelte'

export type ScenarioHostProps = {
    position?: ScenarioPosition | 'finished'
    playerCount?: number
}

export function scenarioHost<
    Raw extends EighteenXXState,
    State extends HydratedEighteenXXState & HydratedGameState<Raw> & Raw
>(
    definition: GameUiDefinition<Raw, State>,
    scenarios: GameDefinition<Raw, State>
): Component<ScenarioHostProps> {
    const scenarioUi: GameUiDefinition<Raw, State> = {
        ...definition,
        info: { ...definition.info, configurator: scenarios.info.configurator },
        runtime: async () => ({
            ...(await definition.runtime()),
            initializer: scenarios.runtime.initializer
        })
    }
    return (anchor, props) =>
        FinanceExampleHost(anchor, {
            definition: scenarioUi,
            get position() {
                return props.position
            },
            get playerCount() {
                return props.playerCount
            }
        })
}
