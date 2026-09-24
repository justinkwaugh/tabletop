import { defineAction, type ActionDefinition } from '../actions/actionDefinition.js'
import type { PrivateRules } from '../privates/privateRules.js'
import type { StockRules } from '../stock/stockRules.js'
import type { EarningsRules } from './earningsDistribution.js'
import {
    DistributeEarnings,
    HydratedDistributeEarnings,
    isDistributeEarnings
} from './distributeEarnings.js'

export function earningsActions(
    earnings: EarningsRules,
    privates: PrivateRules,
    stock: StockRules
): ActionDefinition[] {
    return [
        defineAction(
            DistributeEarnings,
            isDistributeEarnings,
            (action) => new HydratedDistributeEarnings(action, earnings, privates, stock)
        )
    ]
}
