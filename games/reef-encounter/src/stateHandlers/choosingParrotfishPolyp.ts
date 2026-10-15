import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedReefEncounterGameState } from '../model/gameState.js'
import { HydratedFeedParrotfish, isFeedParrotfish } from '../actions/feedParrotfish.js'

export class ChoosingParrotfishPolypStateHandler implements MachineStateHandler<
    HydratedFeedParrotfish,
    HydratedReefEncounterGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedReefEncounterGameState>
    ): action is HydratedFeedParrotfish {
        const gameState = context.gameState
        return (
            isFeedParrotfish(action) &&
            gameState.activePlayerIds.includes(action.playerId) &&
            gameState.getPlayerState(action.playerId).hasSecretSupplyPolyp(action.color)
        )
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedReefEncounterGameState>
    ): ActionType[] {
        return context.gameState.activePlayerIds.includes(playerId)
            ? [ActionType.FeedParrotfish]
            : []
    }

    enter(context: MachineContext<HydratedReefEncounterGameState>) {
        context.gameState.activateTurnPlayer()
    }

    onAction(
        action: HydratedFeedParrotfish,
        context: MachineContext<HydratedReefEncounterGameState>
    ): MachineState {
        context.gameState.finishTurn()
        return context.gameState.isLastInTurnOrder(action.playerId)
            ? MachineState.ChoosingLarvaCubes
            : MachineState.ChoosingParrotfishPolyp
    }
}
