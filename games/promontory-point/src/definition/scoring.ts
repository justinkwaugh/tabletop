import type { GameScoring } from '@tabletop/common'
import type { PromontoryPointProjectedState } from '../model/gameState.js'
import { finalTotals } from '../rules/finalTotals.js'

// R-6.2: each seat's final total, money plus each share at its railroad's final price.
export class PromontoryPointScoring implements GameScoring<PromontoryPointProjectedState> {
    finalScores(state: PromontoryPointProjectedState): Record<string, number> {
        return Object.fromEntries(
            finalTotals(state).map(({ playerId, total }) => [playerId, total])
        )
    }
}
