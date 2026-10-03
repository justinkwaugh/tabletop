import type { GameDefinition } from '@tabletop/common'
import type { EighteenSeventeenState, HydratedEighteenSeventeenState } from '../state.js'
import { withScenarios } from '@tabletop/18xx/scenarios'
import { Definition, EighteenSeventeenTitleRules } from '../definition/gameDefinition.js'
import { createEighteenSeventeenCompanyExample } from './companyExample.js'
import { prepareEighteenSeventeenEnding } from './endingExample.js'
import { createEighteenSeventeenScenarioMarket } from './market.js'

export * from './companyExample.js'
export * from './endingExample.js'
export * from './market.js'

export const EighteenSeventeenScenarios: GameDefinition<
    EighteenSeventeenState,
    HydratedEighteenSeventeenState
> = withScenarios(Definition, EighteenSeventeenTitleRules, {
    createMarket: createEighteenSeventeenScenarioMarket,
    createFinances: createEighteenSeventeenCompanyExample,
    prepareEnding: prepareEighteenSeventeenEnding,
    optionalOpening: { volatility: true }
})
