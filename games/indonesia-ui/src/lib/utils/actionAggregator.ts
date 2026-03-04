import type { GameAction } from '@tabletop/common'
import { ActionType, isExpand } from '@tabletop/indonesia'
import { nanoid } from 'nanoid'

export type AggregatedIndonesiaActionType = ActionType.Expand

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

function isAggregatableIndonesiaAction(action: GameAction): boolean {
    return isExpand(action)
}

function aggregateIndonesiaActions(actions: GameAction[]): AggregatedIndonesiaAction | GameAction {
    if (actions.length === 0) {
        throw Error('No actions to aggregate')
    }

    const first = actions[0]
    if (!first.playerId) {
        return first
    }

    return {
        id: nanoid(),
        gameId: first.gameId,
        source: first.source,
        type: 'AggregatedIndonesiaAction',
        playerId: first.playerId,
        aggregatedType: ActionType.Expand,
        count: actions.length,
        createdAt: first.createdAt
    }
}

export function* aggregateActions(actions: GameAction[]) {
    let currentPlayerId: string | undefined
    let aggregatedGroup: GameAction[] = []

    for (const action of actions) {
        if (isAggregatableIndonesiaAction(action) && action.playerId) {
            if (aggregatedGroup.length === 0) {
                aggregatedGroup = [action]
                currentPlayerId = action.playerId
            } else if (action.playerId === currentPlayerId) {
                aggregatedGroup.push(action)
            } else {
                yield aggregateIndonesiaActions(aggregatedGroup)
                aggregatedGroup = [action]
                currentPlayerId = action.playerId
            }
            continue
        }

        if (aggregatedGroup.length > 0) {
            yield aggregateIndonesiaActions(aggregatedGroup)
            aggregatedGroup = []
            currentPlayerId = undefined
        }
        yield action
    }

    if (aggregatedGroup.length > 0) {
        yield aggregateIndonesiaActions(aggregatedGroup)
    }
}
