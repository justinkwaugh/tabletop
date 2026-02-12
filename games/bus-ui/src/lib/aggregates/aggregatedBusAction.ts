import { ActionSource, type GameAction } from '@tabletop/common'
import { ActionType, type AddPassengers, type PlaceBuilding } from '@tabletop/bus'
import { nanoid } from 'nanoid'

export type AggregatedBusActionType =
    | ActionType.PlaceBusLine
    | ActionType.PlaceBuilding
    | ActionType.AddPassengers
    | ActionType.Vroom

export type AggregatedBusAction = GameAction & {
    type: 'AggregatedBusAction'
    playerId: string
    aggregatedType: AggregatedBusActionType
    count: number
    totalPassengersAdded?: number
    buildingType?: string
    mixedBuildingTypes?: boolean
}

export function isAggregatedBusAction(action?: GameAction): action is AggregatedBusAction {
    return action?.type === 'AggregatedBusAction'
}

export function aggregateBusActions(actions: GameAction[]): AggregatedBusAction | GameAction {
    if (actions.length === 0) {
        throw Error('No actions to aggregate')
    }

    const first = actions[0]
    if (!first.playerId) {
        return first
    }

    const aggregatedType = first.type as AggregatedBusActionType

    const aggregated: AggregatedBusAction = {
        id: nanoid(),
        gameId: first.gameId,
        source: first.source ?? ActionSource.User,
        type: 'AggregatedBusAction',
        playerId: first.playerId,
        aggregatedType,
        count: actions.length,
        createdAt: first.createdAt
    }

    if (aggregatedType === ActionType.AddPassengers) {
        aggregated.totalPassengersAdded = actions.reduce(
            (sum, action) => sum + ((action as AddPassengers).numPassengers ?? 0),
            0
        )
    } else if (aggregatedType === ActionType.PlaceBuilding) {
        const buildingTypes = new Set(actions.map((action) => (action as PlaceBuilding).buildingType))
        if (buildingTypes.size === 1) {
            aggregated.buildingType = Array.from(buildingTypes)[0]
        } else {
            aggregated.mixedBuildingTypes = true
        }
    }

    return aggregated
}
