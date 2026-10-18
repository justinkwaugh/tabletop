import { ActionType } from '../definition/actions.js'
import { canSpendInfluence } from '../model/campaign.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'

// IP's chart: an IP may be turned into $1B at any time, offered wherever a campaign Player is
// taking their turn or playing their phase.
export function influenceActions(
    state: HydratedStellarHorizonsGameState,
    playerId: string
): ActionType[] {
    return canSpendInfluence(state, playerId) ? [ActionType.SpendInfluence] : []
}
