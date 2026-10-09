import {
    ActionSource,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedReefEncounterGameState } from '../model/gameState.js'
import { HydratedRefillOpenSea, isRefillOpenSea } from '../actions/refillOpenSea.js'
import { newTurnRecord } from '../model/turn.js'

export class RefillingOpenSeaStateHandler implements MachineStateHandler<
    HydratedRefillOpenSea,
    HydratedReefEncounterGameState
> {
    isValidAction(action: HydratedAction): action is HydratedRefillOpenSea {
        return isRefillOpenSea(action) && action.source === ActionSource.System
    }

    validActionsForPlayer(): ActionType[] {
        return []
    }

    enter() {}

    // Running short of a larva cube or polyps ends the game with no extra turns (rulebook p. 11).
    onAction(
        action: HydratedRefillOpenSea,
        context: MachineContext<HydratedReefEncounterGameState>
    ): MachineState {
        const gameState = context.gameState
        gameState.turnManager.endTurn(gameState.actionCount)
        gameState.turn = newTurnRecord()
        return action.metadata?.shortage ? MachineState.EndOfGame : MachineState.TakingTurn
    }
}
