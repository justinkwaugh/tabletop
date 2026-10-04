import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { EndTurn, HydratedEndTurn, isEndTurn } from '../actions/endTurn.js'
import type { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'

export class EndOfTurnStateHandler implements MachineStateHandler<
    HydratedEndTurn,
    HydratedStellarHorizonsGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedStellarHorizonsGameState>
    ): action is HydratedEndTurn {
        return isEndTurn(action)
    }

    validActionsForPlayer(): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedStellarHorizonsGameState>) {
        context.gameState.activePlayerIds = []
        context.addSystemAction(EndTurn)
    }

    onAction(action: HydratedEndTurn): MachineState {
        return action.metadata?.gameOver ? MachineState.EndOfGame : MachineState.StartOfTurn
    }
}
