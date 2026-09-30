import { assertExists } from '@tabletop/common'

// R-2.1.6, R-5.1.1 — the Supply costs are printed on the board, not in the Law.
export const VISIONS_DRAWN_SUPPLY_COST: readonly number[] = [2, 3, 3, 4, 4, 4]

/** R-8.5 */
export function visionsDrawnAfter(visionsDrawn: number, drawn: number): number {
    return Math.min(visionsDrawn + drawn, VISIONS_DRAWN_SUPPLY_COST.length - 1)
}

/** R-5.1.1 */
export function worldDeckSearchCost(visionsDrawn: number): number {
    const cost = VISIONS_DRAWN_SUPPLY_COST[visionsDrawn]
    assertExists(cost, `the Visions Drawn track has no space ${visionsDrawn}`)
    return cost
}

/** R-5.1.1 */
export const DISCARD_SEARCH_SUPPLY_COST = 2
