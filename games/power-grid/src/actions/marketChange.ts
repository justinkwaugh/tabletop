import * as Type from 'typebox'
import { Step } from '../components/rules.js'
import { DeckCard } from '../model/plantMarket.js'
import type { HydratedPowerGridGameState, RefillResult } from '../model/gameState.js'

/** What happened to the power plant market: cards drawn, plants removed from the game. */
export type MarketChange = Type.Static<typeof MarketChange>
export const MarketChange = Type.Object({
    drawn: Type.Array(DeckCard),
    removed: Type.Array(Type.Integer()),
    discountLost: Type.Optional(Type.Boolean())
})

export function emptyMarketChange(): MarketChange {
    return { drawn: [], removed: [] }
}

export function mergeRefill(change: MarketChange, refill: RefillResult): MarketChange {
    return {
        drawn: [...change.drawn, ...refill.drawn],
        removed: [...change.removed, ...refill.removed],
        discountLost: change.discountLost || refill.discountLost || undefined
    }
}

export function withRemoved(change: MarketChange, plant: number | undefined): MarketChange {
    return plant === undefined ? change : { ...change, removed: [...change.removed, plant] }
}

// Recharged p. 7: as Step 2 begins, the lowest plant leaves the game and is replaced.
export function beginStep2(state: HydratedPowerGridGameState, change: MarketChange): MarketChange {
    state.step = Step.Two
    return mergeRefill(withRemoved(change, state.removeLowestPlant()), state.refillMarket())
}

// Recharged p. 7: "Extremely rarely, Step 3 may begin before Step 2. In this case, first perform
// all changes for Step 2."
export function beginDrawnStep3(
    state: HydratedPowerGridGameState,
    change: MarketChange
): { market: MarketChange; step2Began: boolean } {
    const step2Began = state.step === Step.One
    const market = step2Began ? beginStep2(state, change) : change
    const removed = withRemoved(market, state.removeStep3Card())
    state.beginStep3()
    return { market: removed, step2Began }
}
