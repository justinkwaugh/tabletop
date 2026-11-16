import * as Type from 'typebox'
import type { HydratedSarGameState } from './gameState.js'

export type AutomaticDevelopment = Type.Static<typeof AutomaticDevelopment>
export const AutomaticDevelopment = Type.Object({
    settlementId: Type.String(),
    income: Type.Number()
})

// Raises the first metro area in the map's order that is not full; nothing when all are.
export function developAutomatically(
    state: HydratedSarGameState
): AutomaticDevelopment | undefined {
    const settlementId = state.automaticDevelopmentTarget()
    if (settlementId === undefined) {
        return undefined
    }
    state.developments[settlementId] = state.developmentLevel(settlementId) + 1
    return { settlementId, income: state.settlementIncome(settlementId) }
}
