import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedReefEncounterGameState } from '../model/gameState.js'
import { HydratedTakeOpenSeaSpace, isTakeOpenSeaSpace } from '../actions/takeOpenSeaSpace.js'
import { HydratedPlayLarvaCube, isPlayLarvaCube } from '../actions/playLarvaCube.js'
import { HydratedPlacePolyp, isPlacePolyp } from '../actions/placePolyp.js'
import { HydratedIntroduceShrimp, isIntroduceShrimp } from '../actions/introduceShrimp.js'
import { HydratedMoveShrimp, isMoveShrimp } from '../actions/moveShrimp.js'
import { HydratedEatCoral, isEatCoral } from '../actions/eatCoral.js'
import {
    HydratedExchangeConsumedPolyp,
    isExchangeConsumedPolyp
} from '../actions/exchangeConsumedPolyp.js'
import { HydratedExchangeLarvaCube, isExchangeLarvaCube } from '../actions/exchangeLarvaCube.js'
import { RefillOpenSea } from '../actions/refillOpenSea.js'
import { CoralColors } from '../components/colors.js'
import { activateTurnPlayer } from '../util/turns.js'

type TakingTurnAction =
    | HydratedEatCoral
    | HydratedPlayLarvaCube
    | HydratedPlacePolyp
    | HydratedIntroduceShrimp
    | HydratedMoveShrimp
    | HydratedExchangeConsumedPolyp
    | HydratedExchangeLarvaCube
    | HydratedTakeOpenSeaSpace

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
        if (isEatCoral(action)) {
            return gameState.canEatCoral(action.playerId, {
                boardId: action.boardId,
                coords: action.coords
            })
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
        if (isIntroduceShrimp(action)) {
            return gameState.canIntroduceShrimp(action.playerId, {
                boardId: action.boardId,
                coords: action.coords
            })
        }
        if (isMoveShrimp(action)) {
            return gameState.canMoveShrimp(action.playerId, action.from, action.to)
        }
        if (isExchangeConsumedPolyp(action)) {
            return gameState.canExchangeConsumedPolyp(action.playerId, action.color)
        }
        if (isExchangeLarvaCube(action)) {
            return gameState.canExchangeLarvaCube(action.playerId, action.color)
        }
        return (
            isTakeOpenSeaSpace(action) &&
            gameState.canTakeOpenSeaSpace(action.playerId, action.larvaColor)
        )
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
        if (gameState.hasEdibleCoral(playerId)) {
            actions.push(ActionType.EatCoral)
        }
        if (CoralColors.some((color) => gameState.canPlayLarvaCube(playerId, color))) {
            actions.push(ActionType.PlayLarvaCube)
        }
        if (gameState.hasLegalPlacement(playerId)) {
            actions.push(ActionType.PlacePolyp)
        }
        if (gameState.hasShrimpIntroduction(playerId)) {
            actions.push(ActionType.IntroduceShrimp)
        }
        if (gameState.hasShrimpOnBoard(playerId)) {
            actions.push(ActionType.MoveShrimp)
        }
        if (CoralColors.some((color) => gameState.canExchangeConsumedPolyp(playerId, color))) {
            actions.push(ActionType.ExchangeConsumedPolyp)
        }
        if (CoralColors.some((color) => gameState.canExchangeLarvaCube(playerId, color))) {
            actions.push(ActionType.ExchangeLarvaCube)
        }
        if (CoralColors.some((color) => gameState.canTakeOpenSeaSpace(playerId, color))) {
            actions.push(ActionType.TakeOpenSeaSpace)
        }
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
