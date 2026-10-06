import type { GameDefinition } from '@tabletop/common'
import type { EighteenThirtyState, HydratedEighteenThirtyState } from '../state.js'
import { withScenarios } from '@tabletop/18xx/scenarios'
import { Definition, EighteenThirtyTitleRules } from '../definition/gameDefinition.js'
import { createEighteenThirtyCompanyExample } from './companyExamples.js'
import { prepareEighteenThirtyEnding } from './endingExample.js'
import { createEighteenThirtyScenarioMarket } from './market.js'

export * from './companyExamples.js'
export * from './endingExample.js'
export * from './financeFixture.js'
export * from './market.js'
export * from './privateExamples.js'

export const EighteenThirtyScenarios: GameDefinition<
    EighteenThirtyState,
    HydratedEighteenThirtyState
> = withScenarios(Definition, EighteenThirtyTitleRules, {
    createMarket: createEighteenThirtyScenarioMarket,
    createFinances: createEighteenThirtyCompanyExample,
    prepareEnding: prepareEighteenThirtyEnding
})
export * from './openingPlay.js'
