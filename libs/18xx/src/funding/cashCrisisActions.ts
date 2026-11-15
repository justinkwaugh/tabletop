import * as Type from 'typebox'
import { assertExists } from '@tabletop/common'
import { defineAction, type ActionDefinition } from '../actions/actionDefinition.js'
import type { CashCrisisRules } from './cashCrisis.js'
import type { ValuationRules } from '../ending/finalWealth.js'
import { HydratedGoBankrupt, goBankruptSchema, isGoBankrupt } from './goBankrupt.js'
import { HydratedSellSharesToPay, SellSharesToPay, isSellSharesToPay } from './sellSharesToPay.js'

/** What a bankruptcy records: the title's elimination, its insolvency, or either. */
function bankruptcyChanges(rules: CashCrisisRules): Type.TSchema {
    const { elimination, insolvency } = rules
    if (elimination && insolvency) return Type.Union([elimination.schema, insolvency.schema])
    const changes = elimination?.schema ?? insolvency?.schema
    assertExists(changes, 'A cash crisis is settled by elimination or insolvency')
    return changes
}

export function cashCrisisActions(
    rules: CashCrisisRules | undefined,
    valuationRules: ValuationRules
): ActionDefinition[] {
    if (!rules) return []
    return [
        defineAction(
            SellSharesToPay,
            isSellSharesToPay,
            (action) => new HydratedSellSharesToPay(action, rules)
        ),
        defineAction(
            goBankruptSchema(bankruptcyChanges(rules)),
            isGoBankrupt,
            (action) => new HydratedGoBankrupt(action, rules, valuationRules)
        )
    ]
}
