import type { AxialCoordinates, GameAction } from '@tabletop/common'
import { isPlaceMarble } from '@tabletop/zertz'

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

// A move takes the groups its marble fills, then the ring it removes and the groups that cuts off.
function ringsTakenBy(action: GameAction): AxialCoordinates[] {
    if (!isPlaceMarble(action) || action.metadata === undefined) {
        return []
    }
    const { claimedOnPlacing, claimedOnRemoving } = action.metadata
    return [
        ...claimedOnPlacing.map((ring) => ring.coords),
        ...(action.remove === undefined ? [] : [action.remove]),
        ...claimedOnRemoving.map((ring) => ring.coords)
    ]
}
