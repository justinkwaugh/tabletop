import { Goods, type Good } from '../data/components.js'
import {
    MarketSpaces,
    MerchantPullGoods,
    MerchantPushGoods,
    MerchantTradeGoods,
    type MarketSpace,
    type MarketSpaceId
} from '../data/guilds.js'
import { HydratedFeudumGameState } from '../model/gameState.js'
import {
    bestMarketCompletions,
    fillMarketWith,
    marketHolds,
    movableToMarket,
    reasonMarketPicksRefused,
    reasonMoveShort,
    takeFromMarket
} from '../model/market.js'
import { canPayGuild, guildSplit, payGuild } from '../model/payments.js'
import type { GuildFunctionName, GuildFunctionParams, GuildFunctionRow } from './guildFunction.js'
import { marketToCartsRow } from './marketToCarts.js'

export interface MerchantTradeOffer {
    readonly good: Good
    /** R-4.6.3 The cheapest of its kind, the next one bought. */
    readonly spaceId: MarketSpaceId
    readonly price: number
    readonly available: number
}

/** R-4.6.3 Each kind's cheapest space, the next one bought. */
function cheapestSpaces(state: HydratedFeudumGameState): MarketSpace[] {
    const { market } = state.guilds.merchant
    return Goods.flatMap(
        (good) => MarketSpaces.findLast((row) => row.good === good && market[row.id]) ?? []
    )
}

/** R-4.6.3 Each good in the market, at the price of the next one. */
export function merchantTradeOffers(state: HydratedFeudumGameState): MerchantTradeOffer[] {
    const holds = marketHolds(state)
    return cheapestSpaces(state).map(({ good, id, price }) => ({
        good,
        spaceId: id,
        price,
        available: holds[good]
    }))
}

/** R-4.6.3 The spaces these goods would leave: within a kind, right to left. */
function spacesBought(state: HydratedFeudumGameState, goods: readonly Good[]): MarketSpace[] {
    const { market } = state.guilds.merchant
    return goods.flatMap((good, index) => {
        const earlier = goods.slice(0, index).filter((other) => other === good).length
        const filled = MarketSpaces.filter((row) => row.good === good && market[row.id])
        return filled.at(-(earlier + 1)) ?? []
    })
}

function shillings(amount: number): string {
    return `${amount} shilling${amount === 1 ? '' : 's'}`
}

function priceOf(spaces: readonly MarketSpace[]): number {
    return spaces.reduce((sum, space) => sum + space.price, 0)
}

/** R-4.6.3 Picks that could be bought, read on a staged input too: no minimum, and any purse. */
function reasonPicksCannotHappen(
    state: HydratedFeudumGameState,
    goods: readonly Good[]
): string | undefined {
    if (goods.length > MerchantTradeGoods) {
        return `Buy at most ${MerchantTradeGoods} goods.`
    }
    const holds = marketHolds(state)
    const short = goods.find((good) => goods.filter((other) => other === good).length > holds[good])
    return short ? `The market holds only ${holds[short]} ${short}.` : undefined
}

const MerchantTrade: GuildFunctionRow = {
    /** R-4.6.3, R-4.6.2 */
    reasonClosed(state, { playerId }) {
        const prices = cheapestSpaces(state).map((space) => space.price)
        if (prices.length === 0) {
            return 'The market is empty.'
        }
        const cheapest = Math.min(...prices)
        return canPayGuild(state, playerId, cheapest)
            ? undefined
            : `The cheapest good costs ${shillings(cheapest)}.`
    },

    /** R-4.6.3, R-4.6.2 */
    reasonRefused(state, { playerId }, { goods = [] }) {
        const cannot = reasonPicksCannotHappen(state, goods)
        if (cannot) {
            return cannot
        }
        if (goods.length === 0) {
            return `Pick up to ${MerchantTradeGoods} goods to buy.`
        }
        const price = priceOf(spacesBought(state, goods))
        return canPayGuild(state, playerId, price)
            ? undefined
            : `Those goods cost ${shillings(price)}.`
    },

    /** R-4.6.3, R-4.6.2 Each good is the cheapest of its kind; the total pays the guild. */
    perform(state, { playerId }, { goods = [] }) {
        const player = state.getPlayerState(playerId)
        const bought = goods.map((good) => {
            const { id, price } = takeFromMarket(state, good)
            player.goods[good] += 1
            return { good, spaceId: id, price }
        })
        const price = bought.reduce((sum, row) => sum + row.price, 0)
        return {
            details: { kind: 'merchant-trade', bought, price },
            payment: payGuild(state, playerId, 'merchant', price)
        }
    },

    /** R-4.6.3 What the picks would cost and where the shillings would go. */
    preview(state, _actor, { goods = [] }) {
        if (reasonPicksCannotHappen(state, goods)) {
            return undefined
        }
        const spaces = spacesBought(state, goods)
        const price = priceOf(spaces)
        const bought = spaces.map(({ good, id, price: paid }) => ({
            good,
            spaceId: id,
            price: paid
        }))
        return {
            details: { kind: 'merchant-trade', bought, price },
            payment: guildSplit(state, 'merchant', price)
        }
    }
}

function reasonPullClosed(state: HydratedFeudumGameState): string | undefined {
    return movableToMarket(state, state.guilds.farmer.barn, MerchantPullGoods) > 0
        ? undefined
        : 'No barn good fits in the market.'
}

function reasonPicksRefused(
    state: HydratedFeudumGameState,
    goods: readonly Good[]
): string | undefined {
    return reasonMarketPicksRefused(
        state,
        goods,
        state.guilds.farmer.barn,
        'barn',
        MerchantPullGoods
    )
}

/** R-4.6.4 Any row or column reaches the threshold, once. */
function reachesThreshold(lines: number): number {
    return Math.min(lines, 1)
}

/** R-4.6.4 Moves the picks. The input is the caller's to have checked. */
function performPull(state: HydratedFeudumGameState, { goods = [] }: GuildFunctionParams) {
    for (const good of goods) {
        state.guilds.farmer.barn[good] -= 1
    }
    const { spaces, rows, columns } = fillMarketWith(state, goods)
    return {
        details: { kind: 'merchant-pull' as const, spaces, rows, columns },
        completions: reachesThreshold(rows + columns)
    }
}

const MerchantPull: GuildFunctionRow = {
    /** R-4.6.1 At least one must move. */
    reasonClosed: reasonPullClosed,

    /** R-4.6.1, R-4.6-H5 As many as fit, up to three. */
    reasonRefused(state, _actor, { goods = [] }) {
        return (
            reasonPicksRefused(state, goods) ??
            reasonMoveShort(
                goods,
                movableToMarket(state, state.guilds.farmer.barn, MerchantPullGoods)
            )
        )
    },

    perform(state, _actor, params) {
        return performPull(state, params)
    },

    /** R-4.6.4 The real rule on a copy; a staged input short of the count is read too. */
    preview(state, _actor, params) {
        if (reasonPicksRefused(state, params.goods ?? [])) {
            return undefined
        }
        const { details, completions } = performPull(
            new HydratedFeudumGameState(state.dehydrate()),
            params
        )
        return { completions, rows: details.rows, columns: details.columns, details }
    },

    /** R-4.6.4 */
    bestCompletions(state) {
        return reachesThreshold(
            bestMarketCompletions(state, state.guilds.farmer.barn, MerchantPullGoods)
        )
    }
}

export const MerchantFunctions: Readonly<Record<GuildFunctionName, GuildFunctionRow>> = {
    trade: MerchantTrade,
    pull: MerchantPull,
    /** R-4.6.5 Each cart or pile completed counts. */
    push: marketToCartsRow('merchant-push', MerchantPushGoods, (completed) => completed)
}
