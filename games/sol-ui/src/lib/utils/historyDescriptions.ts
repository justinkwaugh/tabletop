import type { GameAction } from '@tabletop/common'

export function getHistoryDescriptionForAction(action?: GameAction, _self?: boolean) {
    return action?.type ?? ''
}
