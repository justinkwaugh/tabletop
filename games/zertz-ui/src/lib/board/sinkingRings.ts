import type { AxialCoordinates, GameAction } from '@tabletop/common'
import { isPlaceMarble, isRemoveRing } from '@tabletop/zertz'

// The rings taken off during the latest turn that took any. Players alternate, so a turn is a
// run of consecutive actions by one player.
export function sinkingRingsAfter(actions: readonly GameAction[]): AxialCoordinates[] {
    const lastTaking = actions.findLastIndex((action) => ringsTakenBy(action).length > 0)
    if (lastTaking < 0) {
        return []
    }
    const playerId = actions[lastTaking].playerId
    let turnStart = lastTaking
    while (turnStart > 0 && actions[turnStart - 1].playerId === playerId) {
        turnStart -= 1
    }
    let turnEnd = lastTaking
    while (turnEnd + 1 < actions.length && actions[turnEnd + 1].playerId === playerId) {
        turnEnd += 1
    }
    return actions.slice(turnStart, turnEnd + 1).flatMap(ringsTakenBy)
}

function ringsTakenBy(action: GameAction): AxialCoordinates[] {
    if (isRemoveRing(action)) {
        return [action.coords, ...(action.metadata?.claimedRings ?? []).map((ring) => ring.coords)]
    }
    if (isPlaceMarble(action)) {
        return (action.metadata?.claimedRings ?? []).map((ring) => ring.coords)
    }
    return []
}
