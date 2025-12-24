import type { GameAction } from '@tabletop/common'
import { isActivate } from '@tabletop/sol'

export function getDescriptionForAction(action: GameAction) {
    switch (true) {
        case isActivate(action): {
            return 'activated '
        }
        default:
            return action.type
    }
}
