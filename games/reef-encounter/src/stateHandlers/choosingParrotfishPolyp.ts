import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { feedsInTurnOrder, HydratedReefEncounterGameState } from '../model/gameState.js'
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

    // Everyone feeds at once; games begun before that go on feeding in turn order.
    enter(context: MachineContext<HydratedReefEncounterGameState>) {
        const gameState = context.gameState
        if (feedsInTurnOrder(gameState)) {
            gameState.activateTurnPlayer()
        } else if (gameState.actionCount === 0) {
            gameState.activePlayerIds = [...gameState.turnManager.turnOrder]
        }
    }

    onAction(
        action: HydratedFeedParrotfish,
        context: MachineContext<HydratedReefEncounterGameState>
    ): MachineState {
        const gameState = context.gameState
        if (feedsInTurnOrder(gameState)) {
            gameState.finishTurn()
            return gameState.isLastInTurnOrder(action.playerId)
                ? MachineState.ChoosingLarvaCubes
                : MachineState.ChoosingParrotfishPolyp
        }
        gameState.activePlayerIds = gameState.activePlayerIds.filter(
            (playerId) => playerId !== action.playerId
        )
        return gameState.activePlayerIds.length === 0
            ? MachineState.ChoosingLarvaCubes
            : MachineState.ChoosingParrotfishPolyp
    }
}
