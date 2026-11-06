import type { VesselType } from '../data/components.js'
import { AlchemistPullGoods, AlchemistPushInventions, AlchemistTradePrice } from '../data/guilds.js'
import { HydratedFeudumGameState } from '../model/gameState.js'
import { canPayGuild, guildSplit, payGuild } from '../model/payments.js'
import type { GuildFunctionName, GuildFunctionParams, GuildFunctionRow } from './guildFunction.js'
import { makeInventions, mostInventions, reasonInventionsRefused } from './inventions.js'
import { marketToCartsRow } from './marketToCarts.js'

export interface AlchemistTradeOffer {
    readonly vessel: VesselType
    readonly price: number
}

/** R-4.6.3 Each kind of vessel for sale. */
export function alchemistTradeOffers(state: HydratedFeudumGameState): AlchemistTradeOffer[] {
    return [...new Set(state.guilds.alchemist.vesselsForSale)].map((vessel) => ({
        vessel,
        price: AlchemistTradePrice
    }))
}

const AlchemistTrade: GuildFunctionRow = {
    /** R-4.6.3, R-4.6.2 */
    reasonClosed(state, { playerId }) {
        if (state.guilds.alchemist.vesselsForSale.length === 0) {
            return 'No vessel is for sale.'
        }
        return canPayGuild(state, playerId, AlchemistTradePrice)
            ? undefined
            : `A vessel costs ${AlchemistTradePrice} shillings.`
    },

    /** R-4.6.3 */
    reasonRefused(state, _actor, { vesselType }) {
        if (!vesselType) {
            return 'Pick a vessel for sale.'
        }
        return state.guilds.alchemist.vesselsForSale.includes(vesselType)
            ? undefined
            : `No ${vesselType.replace('-', ' ')} is for sale.`
    },

    /** R-4.6.3, R-4.6.2 The vessel goes to the buyer's supply; it is placed later, for free. */
    perform(state, { playerId }, { vesselType }) {
        const { vesselsForSale } = state.guilds.alchemist
        const index = vesselType ? vesselsForSale.indexOf(vesselType) : -1
        if (vesselType && index >= 0) {
            vesselsForSale.splice(index, 1)
            state.getPlayerState(playerId).vessels[vesselType] += 1
        }
        return {
            details: { kind: 'alchemist-trade', price: AlchemistTradePrice },
            payment: payGuild(state, playerId, 'alchemist', AlchemistTradePrice)
        }
    },

    /** R-4.6.3 The price is the same for any vessel, so it reads before one is picked. */
    preview(state, _actor, { vesselType }) {
        if (vesselType && !state.guilds.alchemist.vesselsForSale.includes(vesselType)) {
            return undefined
        }
        return {
            details: { kind: 'alchemist-trade', price: AlchemistTradePrice },
            payment: guildSplit(state, 'alchemist', AlchemistTradePrice)
        }
    }
}

/** R-4.6.5 Moves the goods and scores each invention made. */
function performPush(state: HydratedFeudumGameState, { inventions = [] }: GuildFunctionParams) {
    const { goodsUsed, barrels } = makeInventions(state, inventions)
    return {
        details: { kind: 'alchemist-push' as const, goodsUsed, barrels },
        completions: inventions.length
    }
}

const AlchemistPush: GuildFunctionRow = {
    /** R-4.6.1 At least one must be possible. */
    reasonClosed(state) {
        return mostInventions(state, AlchemistPushInventions) > 0
            ? undefined
            : 'Nothing can be invented from the carts and piles.'
    },

    /** R-4.6.5, R-4.6.6 The actor chooses how many, one to three (R-4.6.1). */
    reasonRefused(state, _actor, { inventions = [] }) {
        if (inventions.length === 0) {
            return `Pick up to ${AlchemistPushInventions} inventions.`
        }
        return reasonInventionsRefused(state, inventions, AlchemistPushInventions)
    },

    perform(state, _actor, params) {
        return performPush(state, params)
    },

    /** R-4.6.5 The real rule on a copy; a staged input short of the count is read too. */
    preview(state, _actor, params) {
        if (reasonInventionsRefused(state, params.inventions ?? [], AlchemistPushInventions)) {
            return undefined
        }
        return performPush(new HydratedFeudumGameState(state.dehydrate()), params)
    },

    /** R-4.6.5 */
    bestCompletions(state) {
        return mostInventions(state, AlchemistPushInventions)
    }
}

export const AlchemistFunctions: Readonly<Record<GuildFunctionName, GuildFunctionRow>> = {
    trade: AlchemistTrade,
    /** R-4.6.4 Any cart or pile completed reaches the threshold, once. */
    pull: marketToCartsRow('alchemist-pull', AlchemistPullGoods, (completed) =>
        Math.min(completed, 1)
    ),
    push: AlchemistPush
}
