import type { GameAction } from '@tabletop/common'
import { isThreatenAttack } from '@tabletop/napoleons-triumph'

export function actionsOfTheLastAttack(
    actions: readonly GameAction[]
): readonly GameAction[] | undefined {
    const openedAt = actions.findLastIndex((action) => isThreatenAttack(action))
    return openedAt < 0 ? undefined : actions.slice(openedAt)
}
