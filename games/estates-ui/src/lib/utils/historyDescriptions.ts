import type { GameAction } from '@tabletop/common'

export function getHistoryDescriptionForAction(action?: GameAction, self?: boolean) {
    return action?.type ?? ''
}
