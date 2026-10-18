import * as Type from 'typebox'
import {
    BaseConfigurator,
    ConfigOptionType,
    type GameConfig,
    type GameConfigOptions
} from '@tabletop/common'
import {
    FOOTFALL,
    SCENARIOS,
    ScenarioId,
    scenarioDefinition,
    type ScenarioDefinition
} from '../components/scenarios.js'

export type StellarHorizonsGameConfig = Type.Static<typeof StellarHorizonsGameConfig>
export const StellarHorizonsGameConfig = Type.Object({
    scenario: Type.Optional(Type.Enum(ScenarioId))
})

export const StellarHorizonsGameConfigOptions: GameConfigOptions = [
    {
        id: 'scenario',
        type: ConfigOptionType.List,
        name: 'Scenario',
        description:
            'Footfall among the Stars races to settle a nearby system, for up to four players. These are the Voyages explores six sectors for anomalies, for two to four players. The Campaign plays from 2100 for one to seven players.',
        default: FOOTFALL.id,
        options: SCENARIOS.map((scenario) => ({ name: scenario.name, value: scenario.id })),
        alwaysShow: true
    }
]

export class StellarHorizonsConfigurator extends BaseConfigurator {
    schema = StellarHorizonsGameConfig
    options = StellarHorizonsGameConfigOptions
}

export function configuredScenario(config: GameConfig): ScenarioDefinition {
    const scenarioId = Object.values(ScenarioId).find((value) => value === config.scenario)
    return scenarioDefinition(scenarioId ?? FOOTFALL.id)
}
