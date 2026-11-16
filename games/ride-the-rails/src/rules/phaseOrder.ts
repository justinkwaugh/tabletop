import { assert, assertExists } from '@tabletop/common'
import { PhaseName } from '../definition/phases.js'

// R-2.1
export const PHASE_ORDER: readonly PhaseName[] = [
    PhaseName.TakeShare,
    PhaseName.Build,
    PhaseName.Ride
]

// R-2.2: phase 1 runs in reverse turn order; phases 2 and 3 run in turn order.
export function phaseTurnOrder(turnOrder: readonly string[], phase: PhaseName): string[] {
    return phase === PhaseName.TakeShare ? turnOrder.toReversed() : [...turnOrder]
}

// R-2.2
export function firstInPhase(turnOrder: readonly string[], phase: PhaseName): string {
    const playerId = phaseTurnOrder(turnOrder, phase)[0]
    assertExists(playerId, 'A phase needs players')
    return playerId
}

// R-2.2: each player completes their whole phase action before the next player acts.
export function nextInPhase(
    turnOrder: readonly string[],
    phase: PhaseName,
    playerId: string
): string | undefined {
    const order = phaseTurnOrder(turnOrder, phase)
    const index = order.indexOf(playerId)
    assert(index >= 0, `${playerId} is not in the turn order`)
    return order[index + 1]
}
