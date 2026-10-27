import {
    noResources,
    type HydratedPowerGridGameState,
    type Resource,
    type ResourceAmounts
} from '@tabletop/power-grid'

export function basketOf(cart: readonly Resource[]): ResourceAmounts {
    const basket = noResources()
    for (const resource of cart) {
        basket[resource] += 1
    }
    return basket
}

export function cartFits(
    state: HydratedPowerGridGameState,
    playerId: string,
    cart: readonly Resource[]
): boolean {
    return state.canBuyResources(playerId, basketOf(cart))
}
