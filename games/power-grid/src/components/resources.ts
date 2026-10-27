import * as Type from 'typebox'

export enum Resource {
    Coal = 'coal',
    Oil = 'oil',
    Garbage = 'garbage',
    Uranium = 'uranium'
}

export const RESOURCES: readonly Resource[] = [
    Resource.Coal,
    Resource.Oil,
    Resource.Garbage,
    Resource.Uranium
]

export type ResourceAmounts = Type.Static<typeof ResourceAmounts>
export const ResourceAmounts = Type.Object({
    [Resource.Coal]: Type.Integer({ minimum: 0 }),
    [Resource.Oil]: Type.Integer({ minimum: 0 }),
    [Resource.Garbage]: Type.Integer({ minimum: 0 }),
    [Resource.Uranium]: Type.Integer({ minimum: 0 })
})

export function noResources(): ResourceAmounts {
    return { coal: 0, oil: 0, garbage: 0, uranium: 0 }
}

export function addResources(a: ResourceAmounts, b: ResourceAmounts): ResourceAmounts {
    return {
        coal: a.coal + b.coal,
        oil: a.oil + b.oil,
        garbage: a.garbage + b.garbage,
        uranium: a.uranium + b.uranium
    }
}

export function subtractResources(a: ResourceAmounts, b: ResourceAmounts): ResourceAmounts {
    return {
        coal: a.coal - b.coal,
        oil: a.oil - b.oil,
        garbage: a.garbage - b.garbage,
        uranium: a.uranium - b.uranium
    }
}

export function totalResources(amounts: ResourceAmounts): number {
    return RESOURCES.reduce((sum, resource) => sum + amounts[resource], 0)
}

export function hasNoResources(amounts: ResourceAmounts): boolean {
    return totalResources(amounts) === 0
}

export function coversResources(held: ResourceAmounts, needed: ResourceAmounts): boolean {
    return RESOURCES.every((resource) => held[resource] >= needed[resource])
}

export type MarketSpace = { price: number; capacity: number }

// The printed market: coal, oil and garbage share eight spaces of three; uranium has twelve
// single spaces with its expensive tail at 10–16.
const THREE_PER_SPACE: MarketSpace[] = [1, 2, 3, 4, 5, 6, 7, 8].map((price) => ({
    price,
    capacity: 3
}))
const URANIUM_SPACES: MarketSpace[] = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 16].map((price) => ({
    price,
    capacity: 1
}))

export const MARKET_SPACES: Record<Resource, readonly MarketSpace[]> = {
    [Resource.Coal]: THREE_PER_SPACE,
    [Resource.Oil]: THREE_PER_SPACE,
    [Resource.Garbage]: THREE_PER_SPACE,
    [Resource.Uranium]: URANIUM_SPACES
}

export function marketCapacity(resource: Resource): number {
    return MARKET_SPACES[resource].reduce((sum, space) => sum + space.capacity, 0)
}

export const RESOURCE_TOTALS: ResourceAmounts = {
    coal: 24,
    oil: 24,
    garbage: 24,
    uranium: 12
}

/** Prices of the tokens in the market, cheapest first, when `count` tokens fill it from the top. */
export function marketTokenPrices(resource: Resource, count: number): number[] {
    const prices = MARKET_SPACES[resource].flatMap((space) =>
        Array.from({ length: space.capacity }, () => space.price)
    )
    return prices.slice(prices.length - count)
}

export function purchaseCost(resource: Resource, inMarket: number, amount: number): number {
    if (amount > inMarket) {
        return Number.POSITIVE_INFINITY
    }
    return marketTokenPrices(resource, inMarket)
        .slice(0, amount)
        .reduce((sum, price) => sum + price, 0)
}

export function nextTokenPrice(resource: Resource, inMarket: number): number | undefined {
    return marketTokenPrices(resource, inMarket)[0]
}

export function basketCost(market: ResourceAmounts, basket: ResourceAmounts): number {
    return RESOURCES.reduce(
        (sum, resource) => sum + purchaseCost(resource, market[resource], basket[resource]),
        0
    )
}
