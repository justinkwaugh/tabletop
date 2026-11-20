import { assertExists, shuffle, type RandomFunction } from '@tabletop/common'
import { Spaces, type SpaceId } from '../data/board.js'
import type { Good } from '../data/components.js'
import type { RegionId } from '../data/regionTiles.js'
import type { GoodPrice } from './payments.js'
import { goodCounts, type GoodCounts } from './stateSchemas.js'

export function sum(values: readonly number[]): number {
    return values.reduce((total, value) => total + value, 0)
}

/** R-4.6.5 Each total reached is one level. */
export function levelsReached(totals: readonly number[], total: number): number {
    return totals.filter((reached) => total >= reached).length
}

export function shuffled<T>(items: readonly T[], random: RandomFunction): T[] {
    const copy = [...items]
    shuffle(copy, random)
    return copy
}

/** R-1.4 */
export function regionOf(spaceId: SpaceId): RegionId {
    const space = Spaces.find(({ id }) => id === spaceId)
    assertExists(space, `R-1.4 There is a space ${spaceId}`)
    return space.region
}

export function goodCountsOf(goods: readonly Good[]): GoodCounts {
    const counts = goodCounts()
    for (const good of goods) {
        counts[good] += 1
    }
    return counts
}

/** R-7 What a set of turned-in goods comes to, naming only the goods in it. */
export function priceOfGoods(turnedIn: readonly Good[]): GoodPrice {
    const price: Partial<Record<Good, number>> = {}
    for (const good of turnedIn) {
        price[good] = (price[good] ?? 0) + 1
    }
    return price
}

export function shillings(amount: number): string {
    return `${amount} shilling${amount === 1 ? '' : 's'}`
}
