import * as Type from 'typebox'

export enum Good {
    Ore = 'ore',
    Fur = 'fur',
    Amber = 'amber',
    Salt = 'salt'
}

export const GOODS: readonly Good[] = [Good.Ore, Good.Fur, Good.Amber, Good.Salt]

export const GOOD_SUPPLY: Record<Good, number> = {
    [Good.Ore]: 25,
    [Good.Fur]: 18,
    [Good.Amber]: 13,
    [Good.Salt]: 10
}

export const GOOD_VICTORY_POINTS: Record<Good, number> = {
    [Good.Ore]: 1,
    [Good.Fur]: 3,
    [Good.Amber]: 5,
    [Good.Salt]: 7
}

export type GoodCounts = Type.Static<typeof GoodCounts>
export const GoodCounts = Type.Object({
    [Good.Ore]: Type.Integer({ minimum: 0 }),
    [Good.Fur]: Type.Integer({ minimum: 0 }),
    [Good.Amber]: Type.Integer({ minimum: 0 }),
    [Good.Salt]: Type.Integer({ minimum: 0 })
})

export function noGoods(): GoodCounts {
    return { [Good.Ore]: 0, [Good.Fur]: 0, [Good.Amber]: 0, [Good.Salt]: 0 }
}

export function goodCounts(entries: Partial<GoodCounts>): GoodCounts {
    return { ...noGoods(), ...entries }
}

export function totalGoods(counts: GoodCounts): number {
    return GOODS.reduce((sum, good) => sum + counts[good], 0)
}

export function goodsPresent(counts: GoodCounts): Good[] {
    return GOODS.filter((good) => counts[good] > 0)
}

export function hasGoods(holding: GoodCounts, wanted: GoodCounts): boolean {
    return GOODS.every((good) => holding[good] >= wanted[good])
}

export function addGoods(target: GoodCounts, added: GoodCounts) {
    for (const good of GOODS) {
        target[good] += added[good]
    }
}

export function removeGoods(target: GoodCounts, removed: GoodCounts) {
    if (!hasGoods(target, removed)) {
        throw Error('Not enough goods to remove')
    }
    for (const good of GOODS) {
        target[good] -= removed[good]
    }
}

export function goodsValue(counts: GoodCounts): number {
    return GOODS.reduce((sum, good) => sum + counts[good] * GOOD_VICTORY_POINTS[good], 0)
}
