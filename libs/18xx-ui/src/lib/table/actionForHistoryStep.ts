import { ActionSource, type GameAction } from '@tabletop/common'

export function actionForHistoryStep<T extends GameAction>(
    actions: readonly GameAction[],
    actionCount: number,
    matches: (action: GameAction) => action is T
): T | undefined {
    const visible = actions.slice(0, actionCount)
    const start = visible.findLastIndex((action) => action.source === ActionSource.User)
    return visible.slice(Math.max(0, start)).findLast(matches)
}
