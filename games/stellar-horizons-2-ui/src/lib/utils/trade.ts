import {
    GoodsHolderKind,
    shipDefinition,
    tradeGoodDefinition,
    type GoodsCount,
    type GoodsHolder,
    type HydratedStellarHorizonsGameState,
    type SaleOption,
    type TradeGood
} from '@tabletop/stellar-horizons-2'

export interface GoodsGroup {
    good: TradeGood
    count: number
}

import { systemName } from './presentation.js'

export function goodName(good: TradeGood): string {
    return tradeGoodDefinition(good).name
}

// Goods of one kind together, in the order each kind first appears.
export function groupGoods(goods: readonly TradeGood[]): GoodsGroup[] {
    const groups: GoodsGroup[] = []
    for (const good of goods) {
        const group = groups.find((candidate) => candidate.good === good)
        if (group) {
            group.count += 1
        } else {
            groups.push({ good, count: 1 })
        }
    }
    return groups
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
    const earth: Holding = {
        holder: { kind: GoodsHolderKind.Earth },
        label: 'Earth',
        groups: groupGoods(state.getPlayerState(playerId).earthGoods)
    }
    const bases: Holding[] = state.basesOf(playerId).map((base) => ({
        holder: { kind: GoodsHolderKind.Base, systemId: base.systemId },
        label: systemName(base.systemId),
        groups: groupGoods(base.goods)
    }))
    const ships: Holding[] = state.shipsOf(playerId).map((ship) => ({
        holder: { kind: GoodsHolderKind.Ship, shipId: ship.shipId },
        label: shipDefinition(ship.shipId).name,
        groups: groupGoods(ship.goods)
    }))
    return [earth, ...bases, ...ships].filter((holding) => holding.groups.length > 0)
}
