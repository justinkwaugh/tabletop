import type { ScenarioDefinition } from '@tabletop/18xx/scenarios'
import { playgroundTitle, playgroundTitleForType } from '../titles.js'

export const TopScenarios = playgroundTitle('TOP').scenarios
export const ShikokuScenarios = playgroundTitle('1889').scenarios

export function scenarioDefinition(titleId: string): ScenarioDefinition {
    return playgroundTitleForType(titleId).scenarios
}
