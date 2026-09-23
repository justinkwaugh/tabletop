import { defineAction, type ActionDefinition } from '../actions/actionDefinition.js'
import type { StockRules } from './stockRules.js'
import { StartStockRound, HydratedStartStockRound, isStartStockRound } from './startStockRound.js'
import {
    CompleteStockRound,
    HydratedCompleteStockRound,
    isCompleteStockRound
} from './completeStockRound.js'
import { BuyShares, HydratedBuyShares, isBuyShares } from './buyShares.js'
import { SellShares, HydratedSellShares, isSellShares } from './sellShares.js'
import { FinishStockTurn, HydratedFinishStockTurn, isFinishStockTurn } from './finishStockTurn.js'
import {
    SetStockInstruction,
    HydratedSetStockInstruction,
    isSetStockInstruction
} from './setStockInstruction.js'
import {
    StopStockInstruction,
    HydratedStopStockInstruction,
    isStopStockInstruction
} from './stopStockInstruction.js'

export function stockActions(rules: StockRules): ActionDefinition[] {
    return [
        defineAction(
            StartStockRound,
            isStartStockRound,
            (action) => new HydratedStartStockRound(action)
        ),
        defineAction(
            CompleteStockRound,
            isCompleteStockRound,
            (action) => new HydratedCompleteStockRound(action, rules.round)
        ),
        defineAction(BuyShares, isBuyShares, (action) => new HydratedBuyShares(action, rules)),
        defineAction(SellShares, isSellShares, (action) => new HydratedSellShares(action, rules)),
        defineAction(
            FinishStockTurn,
            isFinishStockTurn,
            (action) => new HydratedFinishStockTurn(action, rules)
        ),
        defineAction(
            SetStockInstruction,
            isSetStockInstruction,
            (action) => new HydratedSetStockInstruction(action, rules)
        ),
        defineAction(
            StopStockInstruction,
            isStopStockInstruction,
            (action) => new HydratedStopStockInstruction(action, rules)
        )
    ]
}
