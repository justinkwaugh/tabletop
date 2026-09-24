import { withScenarios } from '@tabletop/18xx/scenarios'
import { Definition, Shikoku1889TitleRules } from '../definition/gameDefinition.js'
import { createShikoku1889CompanyExample } from './companyExamples.js'
import { prepareShikoku1889Ending } from './endingExample.js'
import { createShikoku1889ScenarioMarket } from './market.js'

export * from './companyExamples.js'
export * from './endingExample.js'
export * from './financeFixture.js'
export * from './market.js'
export * from './privateExamples.js'

export const Shikoku1889Scenarios = withScenarios(Definition, Shikoku1889TitleRules, {
    createMarket: createShikoku1889ScenarioMarket,
    createFinances: createShikoku1889CompanyExample,
    prepareEnding: prepareShikoku1889Ending
})
