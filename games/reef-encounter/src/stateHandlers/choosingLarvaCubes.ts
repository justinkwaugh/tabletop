import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedReefEncounterGameState } from '../model/gameState.js'
import { HydratedChooseLarvaCubes, isChooseLarvaCubes } from '../actions/chooseLarvaCubes.js'
import { activateTurnPlayer, endTurnInOrder } from '../util/turns.js'

export class ChoosingLarvaCubesStateHandler implements MachineStateHandler<
    HydratedChooseLarvaCubes,
    HydratedReefEncounterGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedReefEncounterGameState>
    ): action is HydratedChooseLarvaCubes {
        const gameState = context.gameState
        return (
            isChooseLarvaCubes(action) &&
            gameState.activePlayerIds.includes(action.playerId) &&
            gameState.canTakeLarvaCubes(action.colors)
        )
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedReefEncounterGameState>
    ): ActionType[] {
        return context.gameState.activePlayerIds.includes(playerId)
            ? [ActionType.ChooseLarvaCubes]
            : []
    }

    enter(context: MachineContext<HydratedReefEncounterGameState>) {
        activateTurnPlayer(context.gameState)
    }

    onAction(
        action: HydratedChooseLarvaCubes,
        context: MachineContext<HydratedReefEncounterGameState>
    ): MachineState {
        return endTurnInOrder(context.gameState, action.playerId)
            ? MachineState.TakingTurn
            : MachineState.ChoosingLarvaCubes
    }
}
