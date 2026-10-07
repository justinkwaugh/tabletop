import type { GameDefinition } from '@tabletop/common'
import { withScenarios } from '@tabletop/18xx/scenarios'
import { Definition, EighteenThirtyTwoTitleRules } from '../definition/gameDefinition.js'
import type { EighteenThirtyTwoState, HydratedEighteenThirtyTwoState } from '../state.js'
import { createEighteenThirtyTwoCompanyExample } from './companyExamples.js'
import { prepareEighteenThirtyTwoEnding } from './endingExample.js'
import { createEighteenThirtyTwoScenarioMarket } from './market.js'

export * from './companyExamples.js'
export * from './endingExample.js'
export * from './financeFixture.js'
export * from './market.js'
export * from './openingPlay.js'
export * from './privateExamples.js'

export const EighteenThirtyTwoScenarios: GameDefinition<
    EighteenThirtyTwoState,
    HydratedEighteenThirtyTwoState
> = withScenarios(Definition, EighteenThirtyTwoTitleRules, {
    createMarket: createEighteenThirtyTwoScenarioMarket,
    createFinances: createEighteenThirtyTwoCompanyExample,
    prepareEnding: prepareEighteenThirtyTwoEnding
})
