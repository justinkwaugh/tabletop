import type { GameAction } from '@tabletop/common'

export function getDescriptionForAction(action: GameAction) {
    switch (true) {
        default:
            return action.type
    }
}
