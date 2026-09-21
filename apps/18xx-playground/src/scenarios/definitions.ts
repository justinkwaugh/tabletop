import { assertExists, type GameDefinition } from '@tabletop/common'
import type { EighteenXXState, EighteenXXTitleRules, HydratedEighteenXXState } from '@tabletop/18xx'
import { Definition as Top, TheOldPrinceTitleRules } from '@tabletop/the-old-prince'
import { Definition as Shikoku, Shikoku1889TitleRules } from '@tabletop/shikoku-1889'
import { ScenarioConfigurator } from './scenarioPosition.js'
import { ScenarioInitializer, type ScenarioFixtures } from './scenarioInitializer.js'
import { createTheOldPrinceCompanyExample } from './the-old-prince/companyExamples.js'
import { createTheOldPrinceScenarioMarket } from './the-old-prince/market.js'
import { prepareTheOldPrinceEnding } from './the-old-prince/endingExample.js'
import { createShikoku1889CompanyExample } from './shikoku-1889/companyExamples.js'
import { createShikoku1889ScenarioMarket } from './shikoku-1889/market.js'
import { prepareShikoku1889Ending } from './shikoku-1889/endingExample.js'

type TitleDefinition = GameDefinition<EighteenXXState, HydratedEighteenXXState>

function withScenarios(
    definition: TitleDefinition,
    rules: EighteenXXTitleRules,
    fixtures: ScenarioFixtures
): TitleDefinition {
    return {
        info: { ...definition.info, configurator: new ScenarioConfigurator() },
        runtime: { ...definition.runtime, initializer: new ScenarioInitializer(rules, fixtures) }
    }
}

export const TopScenarios = withScenarios(Top, TheOldPrinceTitleRules, {
    createMarket: createTheOldPrinceScenarioMarket,
    createFinances: createTheOldPrinceCompanyExample,
    prepareEnding: prepareTheOldPrinceEnding
})
export const ShikokuScenarios = withScenarios(Shikoku, Shikoku1889TitleRules, {
    createMarket: createShikoku1889ScenarioMarket,
    createFinances: createShikoku1889CompanyExample,
    prepareEnding: prepareShikoku1889Ending
})

const ScenarioDefinitions = [TopScenarios, ShikokuScenarios]
export function scenarioDefinition(titleId: string): TitleDefinition {
    const definition = ScenarioDefinitions.find((candidate) => candidate.info.id === titleId)
    assertExists(definition, `No scenarios for title ${titleId}`)
    return definition
}
