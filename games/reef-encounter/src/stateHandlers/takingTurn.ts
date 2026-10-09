import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedReefEncounterGameState } from '../model/gameState.js'
import { HydratedTakeOpenSeaSpace, isTakeOpenSeaSpace } from '../actions/takeOpenSeaSpace.js'
import { RefillOpenSea } from '../actions/refillOpenSea.js'
import { activateTurnPlayer } from '../util/turns.js'

export class TakingTurnStateHandler implements MachineStateHandler<
    HydratedTakeOpenSeaSpace,
    HydratedReefEncounterGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedReefEncounterGameState>
    ): action is HydratedTakeOpenSeaSpace {
        const gameState = context.gameState
        return (
            isTakeOpenSeaSpace(action) &&
            gameState.activePlayerIds.includes(action.playerId) &&
            gameState.canTakeOpenSeaSpace(action.larvaColor)
        )
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedReefEncounterGameState>
    ): ActionType[] {
        return context.gameState.activePlayerIds.includes(playerId)
            ? [ActionType.TakeOpenSeaSpace]
            : []
    }

    enter(context: MachineContext<HydratedReefEncounterGameState>) {
        activateTurnPlayer(context.gameState)
    }

    onAction(
        _action: HydratedTakeOpenSeaSpace,
        context: MachineContext<HydratedReefEncounterGameState>
    ): MachineState {
        context.addSystemAction(RefillOpenSea, { revealsInfo: true })
        return MachineState.RefillingOpenSea
    }
}
