import { assertExists } from '@tabletop/common'
import { Goods, type Good } from '../data/components.js'
import {
    AlchemistCartSpaces,
    MarketSpaces,
    type CartSpaceId,
    type MarketSpaceId
} from '../data/guilds.js'
import type { HydratedFeudumGameState } from './gameState.js'
import { goodCounts, type GoodCounts } from './stateSchemas.js'

type Market = Readonly<Record<MarketSpaceId, boolean>>

/** R-4.6.5 Lines of the market: a row is a good's bin; a column is one slot across the bins. */
export interface MarketLines {
    readonly rows: number
    readonly columns: number
}

export function goodsTotal(counts: Readonly<GoodCounts>): number {
    return Goods.reduce((sum, good) => sum + counts[good], 0)
}

/** R-4.6.3 Empty spaces in a good's market bin. */
export function marketRoom(state: HydratedFeudumGameState, good: Good): number {
    const { market } = state.guilds.merchant
    return MarketSpaces.filter((row) => row.good === good && !market[row.id]).length
}

/** R-4.6.3 The good takes its bin's lowest empty space. */
export function fillMarket(state: HydratedFeudumGameState, good: Good): MarketSpaceId {
    const { market } = state.guilds.merchant
    const space = MarketSpaces.find((row) => row.good === good && !market[row.id])
    assertExists(space, `R-4.6.3 The ${good} bin has room`)
    market[space.id] = true
    return space.id
}

/** R-4.6.3 Empty spaces in a good's cart. */
export function cartRoom(state: HydratedFeudumGameState, good: Good): number {
    const { carts } = state.guilds.alchemist
    return AlchemistCartSpaces.filter((row) => row.good === good && !carts[row.id]).length
}

/** R-4.6.3 The good takes its cart's lowest empty space. */
export function fillCart(state: HydratedFeudumGameState, good: Good): CartSpaceId {
    const { carts } = state.guilds.alchemist
    const space = AlchemistCartSpaces.find((row) => row.good === good && !carts[row.id])
    assertExists(space, `R-4.6.3 The ${good} cart has room`)
    carts[space.id] = true
    return space.id
}

function isComplete(market: Market, spaces: readonly { readonly id: MarketSpaceId }[]): boolean {
    return spaces.every((space) => market[space.id])
}

function marketRows(): (typeof MarketSpaces)[] {
    return Goods.map((good) => MarketSpaces.filter((row) => row.good === good))
}

function marketColumns(): (typeof MarketSpaces)[] {
    const slots = [...new Set(MarketSpaces.map((row) => row.space))]
    return slots.map((slot) => MarketSpaces.filter((row) => row.space === slot))
}

/** R-4.6.1 Only lines complete now that were not complete before. */
export function completedMarketLines(before: Market, after: Market): MarketLines {
    const completed = (lines: (typeof MarketSpaces)[]) =>
        lines.filter((line) => !isComplete(before, line) && isComplete(after, line)).length
    return { rows: completed(marketRows()), columns: completed(marketColumns()) }
}

/** R-4.6.1 As many of `available` as fit the bins, per good. */
function goodsThatFit(state: HydratedFeudumGameState, available: Readonly<GoodCounts>): GoodCounts {
    const fits = goodCounts()
    for (const good of Goods) {
        fits[good] = Math.min(available[good], marketRoom(state, good))
    }
    return fits
}

/** R-4.6.1, R-4.6-H5 How many must move: all that fit, up to the stated number. */
export function movableToMarket(
    state: HydratedFeudumGameState,
    available: Readonly<GoodCounts>,
    cap: number
): number {
    return Math.min(cap, goodsTotal(goodsThatFit(state, available)))
}

function countsOf(goods: readonly Good[]): GoodCounts {
    const counts = goodCounts()
    for (const good of goods) {
        counts[good] += 1
    }
    return counts
}

/**
 * R-4.6.1 Picks that could go to the market from `available`, with no minimum: a staged input is
 * read too. `R-4.6-H5`'s "as many as fit" is the caller's, against `movableToMarket`.
 */
export function reasonMarketPicksRefused(
    state: HydratedFeudumGameState,
    goods: readonly Good[],
    available: Readonly<GoodCounts>,
    place: string,
    cap: number
): string | undefined {
    if (goods.length > cap) {
        return `Move at most ${cap} goods.`
    }
    const picks = countsOf(goods)
    for (const good of Goods) {
        if (picks[good] > available[good]) {
            return `The ${place} holds only ${available[good]} ${good}.`
        }
        if (picks[good] > marketRoom(state, good)) {
            return `The ${good} bin has room for ${marketRoom(state, good)}.`
        }
    }
    return undefined
}

export interface MarketFill extends MarketLines {
    readonly spaces: MarketSpaceId[]
}

/** R-4.6.1, R-4.6.5 Each good takes its bin's lowest empty space; returns the lines this completed. */
export function fillMarketWith(state: HydratedFeudumGameState, goods: readonly Good[]): MarketFill {
    const before = { ...state.guilds.merchant.market }
    const spaces = goods.map((good) => fillMarket(state, good))
    return { spaces, ...completedMarketLines(before, state.guilds.merchant.market) }
}

function withFilled(market: Market, good: Good, amount: number): Market {
    const next = { ...market }
    const empty = MarketSpaces.filter((row) => row.good === good && !market[row.id])
    for (const space of empty.slice(0, amount)) {
        next[space.id] = true
    }
    return next
}

/** R-4.6.1, R-4.6.5 The best a push or pull can reach, counting rows or columns, whichever is higher. */
export function bestMarketCompletions(
    state: HydratedFeudumGameState,
    available: Readonly<GoodCounts>,
    cap: number
): number {
    const { market } = state.guilds.merchant
    const amount = movableToMarket(state, available, cap)
    const fits = goodsThatFit(state, available)
    return bestLinesCompleted(market, fits, amount)
}

/** R-4.6.1 Tries every way to move `amount`, counting only lines the move completes. */
function bestLinesCompleted(market: Market, fits: Readonly<GoodCounts>, amount: number): number {
    const best = (
        lines: (typeof MarketSpaces)[],
        goods: readonly Good[],
        left: number,
        now: Market
    ): number => {
        const [good, ...rest] = goods
        if (good === undefined) {
            return left > 0
                ? 0
                : lines.filter((line) => !isComplete(market, line) && isComplete(now, line)).length
        }
        let most = 0
        for (let taken = Math.min(fits[good], left); taken >= 0; taken--) {
            most = Math.max(most, best(lines, rest, left - taken, withFilled(now, good, taken)))
        }
        return most
    }
    return Math.max(
        best(marketRows(), Goods, amount, market),
        best(marketColumns(), Goods, amount, market)
    )
}
