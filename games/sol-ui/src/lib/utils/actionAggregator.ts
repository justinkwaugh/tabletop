import { aggregateMoveActions } from '$lib/aggregates/aggregatedMove.js'
import type { GameAction } from '@tabletop/common'
import { Fly, Hurl, isFly, isHurl, isLaunch, isPass, Launch } from '@tabletop/sol'

export function* aggregateActions(actions: GameAction[]) {
    let currentPlayerId: string | undefined
    let aggregatedMoveActions: (Fly | Launch | Hurl)[] = []
    for (const action of actions) {
        if (isFly(action) || isLaunch(action) || isHurl(action)) {
            if (aggregatedMoveActions.length === 0) {
                aggregatedMoveActions.push(action)
                currentPlayerId = action.playerId
            } else if (action.playerId === currentPlayerId) {
                aggregatedMoveActions.push(action)
            } else if (action.playerId !== currentPlayerId) {
                yield aggregateMoveActions(aggregatedMoveActions)
                currentPlayerId = action.playerId
                aggregatedMoveActions = [action]
            }

            if (actions.at(-1)?.id === action.id) {
                yield aggregateMoveActions(aggregatedMoveActions)
                aggregatedMoveActions = []
                currentPlayerId = undefined
            }
        } else {
            const moved = aggregatedMoveActions.length > 0

            if (aggregatedMoveActions.length > 0) {
                yield aggregateMoveActions(aggregatedMoveActions)
                aggregatedMoveActions = []
                currentPlayerId = undefined
            }
            if (!isPass(action) || !moved) {
                yield action
            }
        }
    }
}
