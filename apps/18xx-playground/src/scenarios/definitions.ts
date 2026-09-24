import { assertExists } from '@tabletop/common'
import type { ScenarioDefinition } from '@tabletop/18xx/scenarios'
import { TheOldPrinceScenarios } from '@tabletop/the-old-prince/scenarios'
import { Shikoku1889Scenarios } from '@tabletop/shikoku-1889/scenarios'

export const TopScenarios = TheOldPrinceScenarios
export const ShikokuScenarios = Shikoku1889Scenarios

const ScenarioDefinitions = [TopScenarios, ShikokuScenarios]
export function scenarioDefinition(titleId: string): ScenarioDefinition {
    const definition = ScenarioDefinitions.find((candidate) => candidate.info.id === titleId)
    assertExists(definition, `No scenarios for title ${titleId}`)
    return definition
}
