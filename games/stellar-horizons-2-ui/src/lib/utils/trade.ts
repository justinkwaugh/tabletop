import {
    EARTH_HOLDER,
    GoodsHolderKind,
    baseHolder,
    shipHolder,
    sameHolder,
    shipDefinition,
    tradeGoodDefinition,
    type GoodsCount,
    type GoodsHolder,
    type HydratedStellarHorizonsGameState,
    type SaleOption,
    type TradeGood
} from '@tabletop/stellar-horizons-2'
import { systemName } from './presentation.js'

// Goods of one kind and how many; in a cargo draft a negative count moves them off the ship.
export interface GoodsGroup {
    good: TradeGood
    count: number
}

export function goodName(good: TradeGood): string {
    return tradeGoodDefinition(good).name
}

export function holderName(holder: GoodsHolder): string {
    switch (holder.kind) {
        case GoodsHolderKind.Earth:
            return 'Earth'
        case GoodsHolderKind.Base:
            return `${systemName(holder.systemId)} base`
        case GoodsHolderKind.Ship:
            return shipDefinition(holder.shipId).name
    }
}

// Equal items together with how many there are, in the order each first appears.
function tally<Item>(
    items: readonly Item[],
    same: (a: Item, b: Item) => boolean
): { item: Item; count: number }[] {
    const tallies: { item: Item; count: number }[] = []
    for (const item of items) {
        const entry = tallies.find((candidate) => same(candidate.item, item))
        if (entry) {
            entry.count += 1
        } else {
            tallies.push({ item, count: 1 })
        }
    }
    return tallies
}

export function groupGoods(goods: readonly TradeGood[]): GoodsGroup[] {
    return tally(goods, (a, b) => a === b).map(({ item, count }) => ({ good: item, count }))
}

// Goods placed one at a time, gathered by where they went.
export function holderCounts(holders: readonly GoodsHolder[]): GoodsCount[] {
    return tally(holders, sameHolder).map(({ item, count }) => ({ holder: item, count }))
}

export function goodsToSell(option: SaleOption): number {
    return option.sources.reduce((total, source) => total + source.count, 0)
}

export function goodsText(goods: readonly TradeGood[]): string {
    return groupGoods(goods)
        .map((group) => `${group.count} ${goodName(group.good)}`)
        .join(', ')
}

// A sale takes its goods from ships first, freeing their holds, then from the base or Earth.
export function saleSources(option: SaleOption, count: number): GoodsCount[] {
    const ordered = option.sources.toSorted(
        (a, b) =>
            Number(b.holder.kind === GoodsHolderKind.Ship) -
            Number(a.holder.kind === GoodsHolderKind.Ship)
    )
    let left = count
    const sources: GoodsCount[] = []
    for (const source of ordered) {
        const taken = Math.min(left, source.count)
        if (taken > 0) {
            sources.push({ holder: source.holder, count: taken })
        }
        left -= taken
    }
    return sources
}

export interface Holding {
    holder: GoodsHolder
    label: string
    groups: GoodsGroup[]
}

// Where a Player's goods are: Earth, then their bases, then their ships.
export function holdings(state: HydratedStellarHorizonsGameState, playerId: string): Holding[] {
    const holding = (holder: GoodsHolder, goods: readonly TradeGood[]): Holding => ({
        holder,
        label: holderName(holder),
        groups: groupGoods(goods)
    })
    return [
        holding(EARTH_HOLDER, state.getPlayerState(playerId).earthGoods),
        ...state.basesOf(playerId).map((base) => holding(baseHolder(base.systemId), base.goods)),
        ...state.shipsOf(playerId).map((ship) => holding(shipHolder(ship.shipId), ship.goods))
    ].filter((entry) => entry.groups.length > 0)
}
