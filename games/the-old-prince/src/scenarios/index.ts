import { withScenarios } from '@tabletop/18xx/scenarios'
import { Definition, TheOldPrinceTitleRules } from '../definition/gameDefinition.js'
import { createTheOldPrinceCompanyExample } from './companyExamples.js'
import { prepareTheOldPrinceEnding } from './endingExample.js'
import { createTheOldPrinceScenarioMarket } from './market.js'

export * from './companyExamples.js'
export * from './endingExample.js'
export * from './financeFixture.js'
export * from './market.js'
export * from './privateExamples.js'
export * from './branchSplitExample.js'
export const TheOldPrinceScenarios = withScenarios(Definition, TheOldPrinceTitleRules, {
    createMarket: createTheOldPrinceScenarioMarket,
    createFinances: createTheOldPrinceCompanyExample,
    prepareEnding: prepareTheOldPrinceEnding
})
