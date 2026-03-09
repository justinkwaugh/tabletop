import type { GameAction } from '@tabletop/common'
import { ActionType, isExpand, isRemoveSiapSajiArea } from '@tabletop/indonesia'
import { nanoid } from 'nanoid'

export type AggregatedIndonesiaActionType = ActionType.Expand | ActionType.RemoveSiapSajiArea

export type AggregatedIndonesiaAction = GameAction & {
    type: 'AggregatedIndonesiaAction'
    playerId: string
    aggregatedType: AggregatedIndonesiaActionType
    count: number
}

export function isAggregatedIndonesiaAction(
    action?: GameAction
): action is AggregatedIndonesiaAction {
    return action?.type === 'AggregatedIndonesiaAction'
}

function aggregatedTypeForAction(action: GameAction): AggregatedIndonesiaActionType | null {
    if (isExpand(action)) {
        return ActionType.Expand
    }
    if (isRemoveSiapSajiArea(action)) {
        return ActionType.RemoveSiapSajiArea
    }
    return null
}

function aggregateIndonesiaActions(actions: GameAction[]): AggregatedIndonesiaAction | GameAction {
    if (actions.length === 0) {
        throw Error('No actions to aggregate')
    }

    const first = actions[0]
    const last = actions[actions.length - 1]
    const aggregatedType = aggregatedTypeForAction(first)
    if (!first.playerId) {
        return first
    }
    if (!aggregatedType) {
        return first
    }

    return {
        id: nanoid(),
        gameId: first.gameId,
        source: first.source,
        type: 'AggregatedIndonesiaAction',
        playerId: first.playerId,
        index: last?.index,
        aggregatedType,
        count: actions.length,
        createdAt: first.createdAt
    }
}

export function* aggregateActions(actions: GameAction[]) {
    let currentPlayerId: string | undefined
    let currentAggregatedType: AggregatedIndonesiaActionType | null = null
    let aggregatedGroup: GameAction[] = []

    for (const action of actions) {
        const aggregatedType = aggregatedTypeForAction(action)
        if (aggregatedType && action.playerId) {
            if (aggregatedGroup.length === 0) {
                aggregatedGroup = [action]
                currentPlayerId = action.playerId
                currentAggregatedType = aggregatedType
            } else if (action.playerId === currentPlayerId && aggregatedType === currentAggregatedType) {
                aggregatedGroup.push(action)
            } else {
                yield aggregateIndonesiaActions(aggregatedGroup)
                aggregatedGroup = [action]
                currentPlayerId = action.playerId
                currentAggregatedType = aggregatedType
            }
            continue
        }

        if (aggregatedGroup.length > 0) {
            yield aggregateIndonesiaActions(aggregatedGroup)
            aggregatedGroup = []
            currentPlayerId = undefined
            currentAggregatedType = null
        }
        yield action
    }

    if (aggregatedGroup.length > 0) {
        yield aggregateIndonesiaActions(aggregatedGroup)
    }
}
