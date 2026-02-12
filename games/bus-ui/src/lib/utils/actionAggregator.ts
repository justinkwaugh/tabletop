import type { GameAction } from '@tabletop/common'
import { isAddPassengers, isPlaceBuilding, isPlaceBusLine, isVroom } from '@tabletop/bus'
import { aggregateBusActions } from '$lib/aggregates/aggregatedBusAction.js'

function isAggregatableBusAction(action: GameAction): boolean {
    return (
        isPlaceBusLine(action) ||
        isPlaceBuilding(action) ||
        isAddPassengers(action) ||
        isVroom(action)
    )
}

export function* aggregateActions(actions: GameAction[]) {
    let currentPlayerId: string | undefined
    let currentType: string | undefined
    let aggregatedGroup: GameAction[] = []

    for (const action of actions) {
        if (isAggregatableBusAction(action) && action.playerId) {
            if (aggregatedGroup.length === 0) {
                aggregatedGroup = [action]
                currentPlayerId = action.playerId
                currentType = action.type
            } else if (action.playerId === currentPlayerId && action.type === currentType) {
                aggregatedGroup.push(action)
            } else {
                yield aggregateBusActions(aggregatedGroup)
                aggregatedGroup = [action]
                currentPlayerId = action.playerId
                currentType = action.type
            }
            continue
        }

        if (aggregatedGroup.length > 0) {
            yield aggregateBusActions(aggregatedGroup)
            aggregatedGroup = []
            currentPlayerId = undefined
            currentType = undefined
        }
        yield action
    }

    if (aggregatedGroup.length > 0) {
        yield aggregateBusActions(aggregatedGroup)
    }
}
