import type { HydratedAction } from '@tabletop/common'
import { type HydratedDestroyGoods, isDestroyGoods } from '../actions/destroyGoods.js'
import { type HydratedSpendInfluence, isSpendInfluence } from '../actions/spendInfluence.js'
import { ActionType } from '../definition/actions.js'
import { canSpendInfluence } from '../model/campaign.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { holdsAnyGoods } from '../model/trade.js'

export type ConversionAction = HydratedSpendInfluence | HydratedDestroyGoods

export function isConversion(action: HydratedAction): action is ConversionAction {
    return isSpendInfluence(action) || isDestroyGoods(action)
}

// IP's chart and rulebook 1.9: an IP or a good may be turned into $1B at any time, offered
// wherever a campaign Player is taking their turn or playing their phase.
export function conversionActions(
    state: HydratedStellarHorizonsGameState,
    playerId: string
): ActionType[] {
    return [
        ...(canSpendInfluence(state, playerId) ? [ActionType.SpendInfluence] : []),
        ...(holdsAnyGoods(state, playerId) ? [ActionType.DestroyGoods] : [])
    ]
}
