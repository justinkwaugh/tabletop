import { defineAction, type ActionDefinition } from '../actions/actionDefinition.js'
import type { CashCrisisRules } from './cashCrisis.js'
import { HydratedGoBankrupt, GoBankrupt, isGoBankrupt } from './goBankrupt.js'
import { HydratedSellSharesToPay, SellSharesToPay, isSellSharesToPay } from './sellSharesToPay.js'

export function cashCrisisActions(rules: CashCrisisRules | undefined): ActionDefinition[] {
    if (!rules) return []
    return [
        defineAction(
            SellSharesToPay,
            isSellSharesToPay,
            (action) => new HydratedSellSharesToPay(action, rules)
        ),
        defineAction(GoBankrupt, isGoBankrupt, (action) => new HydratedGoBankrupt(action, rules))
    ]
}
