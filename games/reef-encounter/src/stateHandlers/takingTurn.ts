import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedReefEncounterGameState } from '../model/gameState.js'
import { HydratedTakeOpenSeaSpace, isTakeOpenSeaSpace } from '../actions/takeOpenSeaSpace.js'
import { HydratedPlayLarvaCube, isPlayLarvaCube } from '../actions/playLarvaCube.js'
import { HydratedPlacePolyp, isPlacePolyp } from '../actions/placePolyp.js'
import { RefillOpenSea } from '../actions/refillOpenSea.js'
import { CoralColors } from '../components/colors.js'
import { activateTurnPlayer } from '../util/turns.js'

type TakingTurnAction = HydratedPlayLarvaCube | HydratedPlacePolyp | HydratedTakeOpenSeaSpace

export class TakingTurnStateHandler implements MachineStateHandler<
    TakingTurnAction,
    HydratedReefEncounterGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedReefEncounterGameState>
    ): action is TakingTurnAction {
        const gameState = context.gameState
        if (!gameState.activePlayerIds.includes(action.playerId ?? '')) {
            return false
        }
        if (isPlayLarvaCube(action)) {
            return gameState.canPlayLarvaCube(action.playerId, action.color)
        }
        if (isPlacePolyp(action)) {
            return gameState.canPlacePolyp(
                action.playerId,
                action.boardId,
                action.coords,
                action.fromConsumed
            )
        }
        return isTakeOpenSeaSpace(action) && gameState.canTakeOpenSeaSpace(action.larvaColor)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedReefEncounterGameState>
    ): ActionType[] {
        const gameState = context.gameState
        if (!gameState.activePlayerIds.includes(playerId)) {
            return []
        }
        const actions: ActionType[] = []
        if (CoralColors.some((color) => gameState.canPlayLarvaCube(playerId, color))) {
            actions.push(ActionType.PlayLarvaCube)
        }
        if (gameState.hasLegalPlacement(playerId)) {
            actions.push(ActionType.PlacePolyp)
        }
        actions.push(ActionType.TakeOpenSeaSpace)
        return actions
    }

    enter(context: MachineContext<HydratedReefEncounterGameState>) {
        activateTurnPlayer(context.gameState)
    }

    onAction(
        action: TakingTurnAction,
        context: MachineContext<HydratedReefEncounterGameState>
    ): MachineState {
        if (isTakeOpenSeaSpace(action)) {
            context.addSystemAction(RefillOpenSea, { revealsInfo: true })
            return MachineState.RefillingOpenSea
        }
        return MachineState.TakingTurn
    }
}
