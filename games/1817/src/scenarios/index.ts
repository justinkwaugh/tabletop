import { withScenarios } from '@tabletop/18xx/scenarios'
import { Definition, EighteenSeventeenTitleRules } from '../definition/gameDefinition.js'
import { createEighteenSeventeenCompanyExample } from './companyExample.js'
import { prepareEighteenSeventeenEnding } from './endingExample.js'
import { createEighteenSeventeenScenarioMarket } from './market.js'

export * from './companyExample.js'
export * from './endingExample.js'
export * from './market.js'

export const EighteenSeventeenScenarios = withScenarios(Definition, EighteenSeventeenTitleRules, {
    createMarket: createEighteenSeventeenScenarioMarket,
    createFinances: createEighteenSeventeenCompanyExample,
    prepareEnding: prepareEighteenSeventeenEnding
})
