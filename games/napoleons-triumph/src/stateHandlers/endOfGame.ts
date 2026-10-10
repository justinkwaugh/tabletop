import { type HydratedAction, type MachineContext, type MachineStateHandler } from '@tabletop/common'
import type { ActionType } from '../definition/actions.js'
import type { MachineState } from '../definition/states.js'
import type { HydratedNapoleonsTriumphGameState } from '../model/gameState.js'

export class EndOfGameStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedNapoleonsTriumphGameState
> {
    isValidAction(): boolean {
        return false
    }

    validActionsForPlayer(): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedNapoleonsTriumphGameState>) {
        context.gameState.activePlayerIds = []
    }

    onAction(): MachineState {
        throw Error('The game is over')
    }
}
