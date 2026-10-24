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
    scenario: Type.Optional(Type.Enum(ScenarioId)),
    directives: Type.Optional(Type.Boolean()),
    titles: Type.Optional(Type.Boolean())
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
    },
    {
        id: 'directives',
        type: ConfigOptionType.Boolean,
        name: 'Directives',
        description:
            'Campaign only: each Player holds a secret directive from their government, worth points when fulfilled, and must fulfil a number of their faction’s types or lose 15 points for each one short.',
        default: true
    },
    {
        id: 'titles',
        type: ConfigOptionType.Boolean,
        name: 'Titles',
        description:
            'Campaign only: titles such as Admiral and Chancellor, bought with influence once their prerequisite is met, each worth 10 points and a lasting benefit.',
        default: true
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
