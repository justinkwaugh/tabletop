import type { HydratedAction } from '@tabletop/common'
import { type HydratedChooseDirective, isChooseDirective } from '../actions/chooseDirective.js'
import { type HydratedDestroyGoods, isDestroyGoods } from '../actions/destroyGoods.js'
import { type HydratedRedrawDirective, isRedrawDirective } from '../actions/redrawDirective.js'
import { type HydratedSpendInfluence, isSpendInfluence } from '../actions/spendInfluence.js'
import { ActionType } from '../definition/actions.js'
import { canSpendInfluence } from '../model/campaign.js'
import { canRedrawDirective, choosesDirective } from '../model/directives.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { holdsAnyGoods } from '../model/trade.js'

export type AnytimeAction =
    | HydratedSpendInfluence
    | HydratedDestroyGoods
    | HydratedRedrawDirective
    | HydratedChooseDirective

export function isAnytimeAction(action: HydratedAction): action is AnytimeAction {
    return (
        isSpendInfluence(action) ||
        isDestroyGoods(action) ||
        isRedrawDirective(action) ||
        isChooseDirective(action)
    )
}

// What a campaign Player may do at any time, offered wherever they are taking their turn or
// playing their phase: an IP or a good turned into $1B (IP's chart and rulebook 1.9), and a
// directive redrawn or chosen (rulebook 5.1).
export function anytimeActions(
    state: HydratedStellarHorizonsGameState,
    playerId: string
): ActionType[] {
    return [
        ...(canSpendInfluence(state, playerId) ? [ActionType.SpendInfluence] : []),
        ...(holdsAnyGoods(state, playerId) ? [ActionType.DestroyGoods] : []),
        ...(canRedrawDirective(state, playerId) ? [ActionType.RedrawDirective] : []),
        ...(choosesDirective(state.getPlayerState(playerId)) ? [ActionType.ChooseDirective] : [])
    ]
}
