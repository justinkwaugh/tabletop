import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { GameEndReason, HydratedReefEncounterGameState } from '../model/gameState.js'
import { EndGame } from '../actions/endGame.js'
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
import { HydratedPlayAlgaCylinder, isPlayAlgaCylinder } from '../actions/playAlgaCylinder.js'
import { RefillOpenSea } from '../actions/refillOpenSea.js'
import { SearchBag } from '../actions/searchBag.js'
import { CoralColors } from '../components/colors.js'

type TakingTurnAction =
    | HydratedEatCoral
    | HydratedPlayLarvaCube
    | HydratedPlacePolyp
    | HydratedIntroduceShrimp
    | HydratedMoveShrimp
    | HydratedExchangeConsumedPolyp
    | HydratedExchangeLarvaCube
    | HydratedPlayAlgaCylinder
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
        if (isPlayAlgaCylinder(action)) {
            return gameState.canPlayAlgaCylinder(
                action.playerId,
                action.consumedColor,
                action.alga,
                action.tileId
            )
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
        if (gameState.hasAlgaCylinderPlay(playerId)) {
            actions.push(ActionType.PlayAlgaCylinder)
        }
        if (CoralColors.some((color) => gameState.canTakeOpenSeaSpace(playerId, color))) {
            actions.push(ActionType.TakeOpenSeaSpace)
        }
        return actions
    }

    enter(context: MachineContext<HydratedReefEncounterGameState>) {
        context.gameState.activateTurnPlayer()
    }

    onAction(
        action: TakingTurnAction,
        context: MachineContext<HydratedReefEncounterGameState>
    ): MachineState {
        if (isTakeOpenSeaSpace(action)) {
            context.addSystemAction(RefillOpenSea, { revealsInfo: true })
            return MachineState.RefillingOpenSea
        }
        if (isExchangeLarvaCube(action) && action.metadata?.searchesBag) {
            context.addSystemAction(SearchBag, {
                revealsInfo: true,
                color: action.color,
                need: { kind: 'exchange', playerId: action.playerId }
            })
            return MachineState.SearchingBag
        }
        if (isPlacePolyp(action) && action.metadata?.extraGrowthSearchesBag) {
            context.addSystemAction(SearchBag, {
                revealsInfo: true,
                color: action.metadata.color,
                need: { kind: 'extraGrowth', boardId: action.boardId }
            })
            return MachineState.SearchingBag
        }
        if (!isEatCoral(action) && !isPlayAlgaCylinder(action) && !isPlacePolyp(action)) {
            return MachineState.TakingTurn
        }
        return endGameIfReached(context, action.playerId)
    }
}

// The game ends at once; the player does nothing more, not even action 10 (rulebook p. 11).
export function endGameIfReached(
    context: MachineContext<HydratedReefEncounterGameState>,
    playerId: string
): MachineState {
    const gameState = context.gameState
    const endReason = gameState.gameEndReachedBy(playerId)
    if (!endReason) {
        return MachineState.TakingTurn
    }
    gameState.endReason = endReason
    if (endReason === GameEndReason.NoRockLeft) {
        context.addSystemAction(EndGame, { revealsInfo: true })
        return MachineState.EndingGame
    }
    gameState.endingPlayerId = playerId
    gameState.finishTurn()
    return MachineState.FinalTurns
}
