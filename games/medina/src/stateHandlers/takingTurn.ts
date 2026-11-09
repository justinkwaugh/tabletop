import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { HydratedPlaceBuilding, isPlaceBuilding } from '../actions/placeBuilding.js'
import { HydratedPlaceMerchant, isPlaceMerchant } from '../actions/placeMerchant.js'
import { HydratedPlaceRooftop, isPlaceRooftop } from '../actions/placeRooftop.js'
import { HydratedPlaceStable, isPlaceStable } from '../actions/placeStable.js'
import { HydratedPlaceWall, isPlaceWall } from '../actions/placeWall.js'
import { HydratedTakeTeaBreak, isTakeTeaBreak } from '../actions/takeTeaBreak.js'
import type { HydratedMedinaGameState } from '../model/gameState.js'

type TakingTurnAction =
    | HydratedPlaceBuilding
    | HydratedPlaceRooftop
    | HydratedPlaceStable
    | HydratedPlaceMerchant
    | HydratedPlaceWall
    | HydratedTakeTeaBreak

export class TakingTurnStateHandler implements MachineStateHandler<
    TakingTurnAction,
    HydratedMedinaGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedMedinaGameState>
    ): action is TakingTurnAction {
        return (
            isPlaceBuilding(action) ||
            isPlaceRooftop(action) ||
            isPlaceStable(action) ||
            isPlaceMerchant(action) ||
            isPlaceWall(action) ||
            isTakeTeaBreak(action)
        )
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedMedinaGameState>
    ): ActionType[] {
        const state = context.gameState
        const available: [ActionType, boolean][] = [
            [ActionType.PlaceBuilding, state.canPlaceBuilding(playerId)],
            [ActionType.PlaceRooftop, state.canPlaceRooftop(playerId)],
            [ActionType.PlaceStable, state.canPlaceStable(playerId)],
            [ActionType.PlaceMerchant, state.canPlaceMerchant(playerId)],
            [ActionType.PlaceWall, state.canPlaceWall(playerId)],
            [ActionType.TakeTeaBreak, state.canTakeTeaBreak(playerId)]
        ]
        return available.filter(([, allowed]) => allowed).map(([type]) => type)
    }

    enter(context: MachineContext<HydratedMedinaGameState>) {
        const state = context.gameState
        if (state.turn) {
            return
        }
        const playerId = state.turnManager.startNextTurn(state.actionCount, (candidate) =>
            state.isPlaceable(candidate)
        )
        state.beginTurn(playerId)
        state.activePlayerIds = [playerId]
    }

    onAction(
        action: TakingTurnAction,
        context: MachineContext<HydratedMedinaGameState>
    ): MachineState {
        const state = context.gameState
        const turn = state.activeTurn()
        if (!isTakeTeaBreak(action)) {
            turn.placementsMade += 1
            turn.placementsLeft -= 1
        }
        if (turn.placementsLeft > 0 && state.isPlaceable(action.playerId)) {
            return MachineState.TakingTurn
        }
        state.turnManager.endTurn(state.actionCount)
        state.turn = undefined
        return state.anyPlayerCanPlace() ? MachineState.TakingTurn : MachineState.EndOfGame
    }
}
