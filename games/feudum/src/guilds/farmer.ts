import { Goods, type Good } from '../data/components.js'
import type { SpaceId } from '../data/board.js'
import {
    FarmerBarn,
    FarmerPullThreshold,
    FarmerPurse,
    FarmerPushGoods,
    FarmerTradeGoods
} from '../data/guilds.js'
import {
    beadValue,
    chickenBeadSum,
    drawBeadToChicken,
    emptyChicken,
    hiddenBeadCandidates
} from '../model/beads.js'
import { HydratedFeudumGameState } from '../model/gameState.js'
import { pickGood } from '../model/haversack.js'
import {
    bestMarketCompletions,
    cartRoom,
    fillCart,
    fillMarket,
    fillMarketWith,
    goodsTotal,
    marketRoom,
    movableToMarket,
    reasonMarketPicksRefused,
    reasonMoveShort
} from '../model/market.js'
import { goodCounts, type GoodCounts } from '../model/stateSchemas.js'
import {
    payShillingsFromSupply,
    returnGoodToHaversack,
    takeGoodFromHaversack
} from '../model/supply.js'
import {
    scoringPreview,
    splitPot,
    type FunctionActor,
    type GuildFunctionName,
    type GuildFunctionParams,
    type GuildFunctionRow,
    type TradePreview
} from './guildFunction.js'

export interface FarmerTradeOffer {
    readonly spaceId: SpaceId
    readonly sent: number
    /** R-4.6.3 Each is 1 food or 1 shilling. */
    readonly rewards: number
}

function rewardsFor(sent: number): number {
    return Math.floor(sent / FarmerTradeGoods)
}

/** R-4.6.3 Each farm the seat rules that has goods. */
export function farmerTradeOffers(
    state: HydratedFeudumGameState,
    playerId: string
): FarmerTradeOffer[] {
    return state.ruledSpaceIds(playerId).flatMap((spaceId) => {
        const { location, goods } = state.spaces[spaceId]
        const sent = goodsTotal(goods)
        return location.kind === 'farm' && sent > 0
            ? [{ spaceId, sent, rewards: rewardsFor(sent) }]
            : []
    })
}

/** R-4.6.3 The barn's limit and the beads decide how much spills, however the goods fall. */
function shipmentFates(state: HydratedFeudumGameState, sent: number) {
    const room = Math.max(0, FarmerBarn.capacity - goodsTotal(state.guilds.farmer.barn))
    const surplus = Math.max(0, sent - room)
    const spill = Math.min(chickenBeadSum(state), surplus)
    return { room, surplus, spill }
}

/** R-4.6.3 The food asked for, as the haversack can give it, and the rest in shillings. */
function tradeReward(state: HydratedFeudumGameState, sent: number, takeFood = 0) {
    const rewards = rewardsFor(sent)
    return {
        food: Math.min(takeFood, state.supply.haversack.food),
        shillings: Math.min(rewards - takeFood, state.supply.shillings)
    }
}

/** R-4.6.3 Each spilt good: its market bin, else its cart, else the haversack. */
function spillGood(
    state: HydratedFeudumGameState,
    good: Good,
    fates: { toMarket: GoodCounts; toCarts: GoodCounts; toHaversack: GoodCounts }
): void {
    if (marketRoom(state, good) > 0) {
        fillMarket(state, good)
        fates.toMarket[good] += 1
    } else if (cartRoom(state, good) > 0) {
        fillCart(state, good)
        fates.toCarts[good] += 1
    } else {
        returnGoodToHaversack(state, good)
        fates.toHaversack[good] += 1
    }
}

/** R-4.6.3, R-4.6-H6 Pays the reward, then ships the farm: the spill is picked first. */
function performTrade(
    state: HydratedFeudumGameState,
    { playerId }: FunctionActor,
    { farmSpaceId, takeFood }: GuildFunctionParams
) {
    const space = farmSpaceId && state.spaces[farmSpaceId]
    const sent = space ? { ...space.goods } : goodCounts()
    const total = goodsTotal(sent)
    const reward = tradeReward(state, total, takeFood)
    const player = state.getPlayerState(playerId)
    player.goods.food += takeGoodFromHaversack(state, 'food', reward.food)
    const shillings = payShillingsFromSupply(state, playerId, reward.shillings)
    const { room, spill } = shipmentFates(state, total)
    if (space) {
        space.goods = goodCounts()
    }

    const shipment = { ...sent }
    const fates = { toMarket: goodCounts(), toCarts: goodCounts(), toHaversack: goodCounts() }
    const { random } = state.getProtectedPrng()
    for (let index = 0; index < spill; index++) {
        const good = pickGood(shipment, random)
        if (good) {
            shipment[good] -= 1
            spillGood(state, good, fates)
        }
    }

    const toBarn = goodCounts()
    let left = room
    for (const good of Goods) {
        const stored = Math.min(left, shipment[good])
        left -= stored
        toBarn[good] = stored
        state.guilds.farmer.barn[good] += stored
        const over = shipment[good] - stored
        returnGoodToHaversack(state, good, over)
        fates.toHaversack[good] += over
    }
    return {
        details: {
            kind: 'farmer-trade' as const,
            sent,
            food: reward.food,
            shillings,
            toBarn,
            ...fates
        },
        revealed: spill > 0
    }
}

const FarmerTrade: GuildFunctionRow = {
    /** R-4.6.3 */
    reasonClosed(state, { playerId }) {
        return farmerTradeOffers(state, playerId).length > 0
            ? undefined
            : 'You rule no farm with goods.'
    },

    /** R-4.6.3 */
    reasonRefused(state, { playerId }, { farmSpaceId, takeFood = 0 }) {
        if (!farmSpaceId) {
            return 'Pick a farm you rule.'
        }
        const space = state.spaces[farmSpaceId]
        if (space.location.kind !== 'farm' || space.ruler?.playerId !== playerId) {
            return 'You rule no farm there.'
        }
        const sent = goodsTotal(space.goods)
        if (sent === 0) {
            return 'That farm has no goods.'
        }
        return takeFood > rewardsFor(sent)
            ? `${sent} goods earn at most ${rewardsFor(sent)} food.`
            : undefined
    },

    perform: performTrade,

    /** R-4.6.3 Nothing is drawn: the preview counts the spill without picking it. */
    preview(state, { playerId }, { farmSpaceId, takeFood }) {
        const offer = farmerTradeOffers(state, playerId).find(
            ({ spaceId }) => spaceId === farmSpaceId
        )
        if (!offer) {
            return undefined
        }
        const { room, surplus, spill } = shipmentFates(state, offer.sent)
        const trade: TradePreview = {
            sent: offer.sent,
            ...tradeReward(state, offer.sent, takeFood),
            surplus,
            spill,
            toBarn: Math.min(room, offer.sent - spill)
        }
        return { trade, revealed: spill > 0 }
    }
}

function reachesPullThreshold(sum: number): number {
    return sum >= FarmerPullThreshold ? 1 : 0
}

/** R-4.6.4, R-4.6-H2 */
function reasonPullClosed(state: HydratedFeudumGameState): string | undefined {
    if (!hiddenBeadCandidates(state)) {
        return 'The rosary needs at least 2 beads.'
    }
    return emptyChicken(state) === undefined ? 'No chicken is empty.' : undefined
}

const FarmerPull: GuildFunctionRow = {
    reasonClosed: reasonPullClosed,

    reasonRefused: reasonPullClosed,

    /** R-4.6.4, R-4.6-H2 A bead onto an empty chicken: a barrier, whatever it scores. */
    perform(state) {
        const { high, low, bead, chicken, chickenSum } = drawBeadToChicken(state)
        return {
            details: { kind: 'farmer-pull', high, low, bead, chicken, chickenSum },
            completions: reachesPullThreshold(chickenSum),
            revealed: true
        }
    },

    /** R-4.6.4, R-4.6-H2 The bead is unknown, so both outcomes: the high at the top, and the low. */
    preview(state, actor) {
        const candidates = hiddenBeadCandidates(state)
        if (!candidates || emptyChicken(state) === undefined) {
            return undefined
        }
        const { high, low } = candidates
        const sum = chickenBeadSum(state)
        const ifLow = reachesPullThreshold(sum + beadValue(low))
        return {
            completions: reachesPullThreshold(sum + beadValue(high)),
            revealed: true,
            beadDraw: { high, low, ifLow: scoringPreview(state, actor, 'farmer', 'pull', ifLow) }
        }
    },

    /** R-4.6.4 The high bead is the best it can do. */
    bestCompletions(state) {
        const candidates = hiddenBeadCandidates(state)
        return candidates
            ? reachesPullThreshold(chickenBeadSum(state) + beadValue(candidates.high))
            : 0
    }
}

/** R-4.6.5 Moves the picks and splits the purse. The input is the caller's to have checked. */
function performPush(
    state: HydratedFeudumGameState,
    actor: FunctionActor,
    { goods = [], count }: GuildFunctionParams
) {
    const { farmer } = state.guilds
    for (const good of goods) {
        farmer.barn[good] -= 1
    }
    const { spaces, rows, columns } = fillMarketWith(state, goods)
    const chosen = count ?? (columns > rows ? 'columns' : 'rows')
    const split = splitPot(state, FarmerPurse.id, farmer.purse, 'farmer', actor)
    farmer.purse = split.stays
    return {
        details: { kind: 'farmer-push' as const, spaces, rows, columns, count: chosen },
        completions: chosen === 'rows' ? rows : columns,
        split
    }
}

function reasonPushClosed(state: HydratedFeudumGameState): string | undefined {
    return movableToMarket(state, state.guilds.farmer.barn, FarmerPushGoods) > 0
        ? undefined
        : 'No barn good fits in the market.'
}

function reasonPicksRefused(
    state: HydratedFeudumGameState,
    goods: readonly Good[]
): string | undefined {
    return reasonMarketPicksRefused(state, goods, state.guilds.farmer.barn, 'barn', FarmerPushGoods)
}

const FarmerPush: GuildFunctionRow = {
    /** R-4.6.1 At least one must move. */
    reasonClosed: reasonPushClosed,

    /** R-4.6.1, R-4.6-H5 As many as fit, up to five. */
    reasonRefused(state, _actor, { goods = [] }) {
        const movable = movableToMarket(state, state.guilds.farmer.barn, FarmerPushGoods)
        return reasonPicksRefused(state, goods) ?? reasonMoveShort(goods, movable)
    },

    perform: performPush,

    /** R-4.6.5 The real rule on a copy; a staged input short of the count is read too. */
    preview(state, actor, params) {
        if (reasonPicksRefused(state, params.goods ?? [])) {
            return undefined
        }
        const { details, completions, split } = performPush(
            new HydratedFeudumGameState(state.dehydrate()),
            actor,
            params
        )
        return { completions, split, rows: details.rows, columns: details.columns }
    },

    /** R-4.6.5 */
    bestCompletions(state) {
        return bestMarketCompletions(state, state.guilds.farmer.barn, FarmerPushGoods)
    }
}

export const FarmerFunctions: Readonly<Record<GuildFunctionName, GuildFunctionRow>> = {
    trade: FarmerTrade,
    pull: FarmerPull,
    push: FarmerPush
}
