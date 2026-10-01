import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { HydratedBuildMarket, isBuildMarket } from '../actions/buildMarket.js'
import { HydratedEndTurn, isEndTurn } from '../actions/endTurn.js'
import { HydratedPlaceCity, isPlaceCity } from '../actions/placeCity.js'
import { HydratedPlaceRoad, isPlaceRoad } from '../actions/placeRoad.js'
import { HydratedResupply, isResupply } from '../actions/resupply.js'
import { HydratedSellMarket, isSellMarket } from '../actions/sellMarket.js'
import { EndTurnOutcome, type HydratedMagnaGreciaGameState } from '../model/gameState.js'

type TakingTurnAction =
    | HydratedPlaceRoad
    | HydratedPlaceCity
    | HydratedResupply
    | HydratedBuildMarket
    | HydratedSellMarket
    | HydratedEndTurn

export class TakingTurnStateHandler implements MachineStateHandler<
    TakingTurnAction,
    HydratedMagnaGreciaGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedMagnaGreciaGameState>
    ): action is TakingTurnAction {
        return (
            isPlaceRoad(action) ||
            isPlaceCity(action) ||
            isResupply(action) ||
            isBuildMarket(action) ||
            isSellMarket(action) ||
            isEndTurn(action)
        )
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedMagnaGreciaGameState>
    ): ActionType[] {
        const state = context.gameState
        const available: [ActionType, boolean][] = [
            [ActionType.PlaceRoad, HydratedPlaceRoad.canPlaceRoad(state, playerId)],
            [ActionType.PlaceCity, HydratedPlaceCity.canPlaceCity(state, playerId)],
            [ActionType.Resupply, HydratedResupply.canResupply(state, playerId)],
            [ActionType.BuildMarket, HydratedBuildMarket.canBuildMarket(state, playerId)],
            [ActionType.SellMarket, HydratedSellMarket.canSellMarket(state, playerId)],
            [ActionType.EndTurn, HydratedEndTurn.canEndTurn(state, playerId)]
        ]
        return available.filter(([, allowed]) => allowed).map(([type]) => type)
    }

    enter(context: MachineContext<HydratedMagnaGreciaGameState>) {
        const state = context.gameState
        if (state.turn) {
            return
        }
        const playerId = state.beginTurn()
        state.turnManager.startTurn(playerId, state.actionCount)
        state.activePlayerIds = [playerId]
    }

    onAction(
        action: TakingTurnAction,
        context: MachineContext<HydratedMagnaGreciaGameState>
    ): MachineState {
        switch (true) {
            case isPlaceRoad(action):
            case isPlaceCity(action):
            case isResupply(action):
            case isBuildMarket(action):
            case isSellMarket(action):
                return MachineState.TakingTurn
            case isEndTurn(action):
                return this.finishTurn(action, context.gameState)
            default:
                throw Error('Invalid action type')
        }
    }

    private finishTurn(
        action: TakingTurnAction,
        state: HydratedMagnaGreciaGameState
    ): MachineState {
        const outcome = state.endTurnOutcome()
        state.turnManager.endTurn(state.actionCount)
        state.turn = undefined
        state.turnIndex += 1
        switch (outcome) {
            case EndTurnOutcome.NextPlayer:
                return MachineState.TakingTurn
            case EndTurnOutcome.EndsGame:
                return MachineState.EndOfGame
            case EndTurnOutcome.RevealsCard:
                action.revealsInfo = true
                state.beginRound(state.round + 1)
                return MachineState.TakingTurn
            case EndTurnOutcome.NextRound:
                state.beginRound(state.round + 1)
                return MachineState.TakingTurn
        }
    }
}
