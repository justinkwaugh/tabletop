import { PlayerStatus } from '../model/oathEnums.js'
import { PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { isBattlePlanCard } from '../util/battlePlans.js'
import { isImperialPlayer, isImperialSite } from '../util/rule.js'
import type { PersistentContext } from '../util/persistent.js'
import { registerPersistent } from './registry.js'
import { holdsTheTurn } from '../util/turn.js'

// "Act as if bandits are your warbands except at sites ruled by enemies. (You rule empty
//  sites.) They cannot be killed, moved, or sacrificed." R-7.6.5.
const BANDIT_CROWN = 'relic.bandit-crown'
registerPersistent(BANDIT_CROWN, powerIndexOf(BANDIT_CROWN, PowerTiming.Persistent), {
    banditsAreHolderWarbands: true
})

// "If you're an Exile, during your turn you rule cards except battle plans at Imperial sites,
//  and Imperial players do not."
const GRAND_MASK = 'relic.grand-mask'

function grandMaskWearerId(ctx: PersistentContext): string | undefined {
    const holderId = ctx.ownerIds[0]
    if (ctx.state.getPlayerState(holderId).status !== PlayerStatus.Exile) return undefined
    if (!holdsTheTurn(ctx.state, holderId)) return undefined
    return holderId
}

registerPersistent(GRAND_MASK, powerIndexOf(GRAND_MASK, PowerTiming.Persistent), {
    cardRuleAt: (ctx, playerId, cardId, siteId, scope) => {
        const wearerId = grandMaskWearerId(ctx)
        if (wearerId === undefined) return undefined
        if (!isImperialSite(ctx.state, siteId) || isBattlePlanCard(ctx.state, cardId))
            return undefined
        if (playerId === wearerId) return true
        return isImperialPlayer(ctx.state, playerId, scope) ? false : undefined
    }
})
