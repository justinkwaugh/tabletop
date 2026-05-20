import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedRepositionArchitect, isRepositionArchitect } from '../actions/repositionArchitect.js'
import { HydratedPlaceBuilding, isPlaceBuilding } from '../actions/placeBuilding.js'
import { HydratedPass, isPass } from '../actions/pass.js'
import { HydratedUrbinoGameState } from '../model/gameState.js'
import { hasAnyValidPlacement, hasAnyValidPlacementAfterReposition } from '../logic/board.js'

type TakingTurnAction = HydratedRepositionArchitect | HydratedPlaceBuilding | HydratedPass

export class TakingTurnStateHandler
    implements MachineStateHandler<TakingTurnAction, HydratedUrbinoGameState>
{
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedUrbinoGameState>
    ): action is TakingTurnAction {
        return isRepositionArchitect(action) || isPlaceBuilding(action) || isPass(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedUrbinoGameState>
    ): ActionType[] {
        const { gameState } = context
        const player = gameState.getPlayerState(playerId)
        const buildings = player.remainingBuildings
        const canPlaceNow = hasAnyValidPlacement(
            gameState.board,
            gameState.architects,
            playerId,
            buildings,
            gameState.monumentsVariant
        )
        const actions: ActionType[] = []
        if (gameState.hasRepositionedThisTurn) {
            // Already repositioned — can only place or pass
            if (canPlaceNow) {
                actions.push(ActionType.PlaceBuilding)
            } else {
                actions.push(ActionType.Pass)
            }
        } else {
            const canPlaceAfterReposition = hasAnyValidPlacementAfterReposition(
                gameState.board,
                gameState.architects,
                playerId,
                buildings,
                gameState.monumentsVariant
            )
            if (canPlaceNow) {
                actions.push(ActionType.RepositionArchitect)
                actions.push(ActionType.PlaceBuilding)
            } else if (canPlaceAfterReposition) {
                // Must reposition before placing — pass not allowed
                actions.push(ActionType.RepositionArchitect)
            } else {
                actions.push(ActionType.Pass)
            }
        }
        return actions
    }

    enter(context: MachineContext<HydratedUrbinoGameState>) {
        const { gameState } = context
        const playerId = gameState.turnManager.currentTurn()?.playerId
        if (playerId) {
            gameState.activePlayerIds = [playerId]
        }
    }

    onAction(
        action: TakingTurnAction,
        context: MachineContext<HydratedUrbinoGameState>
    ): MachineState {
        const { gameState } = context
        switch (true) {
            case isRepositionArchitect(action): {
                // apply() already moved the architect and set hasRepositionedThisTurn = true
                // Stay in same state, same player's turn continues
                return MachineState.TakingTurn
            }
            case isPlaceBuilding(action): {
                // apply() already placed the building, decremented count, reset flags
                gameState.turnManager.endTurn(gameState.actionCount)
                gameState.turnManager.startNextTurn(gameState.actionCount, () => true)
                return MachineState.TakingTurn
            }
            case isPass(action): {
                // apply() already incremented consecutivePasses and reset hasRepositionedThisTurn
                gameState.turnManager.endTurn(gameState.actionCount)
                if (gameState.consecutivePasses >= 2) {
                    return MachineState.EndOfGame
                }
                gameState.turnManager.startNextTurn(gameState.actionCount, () => true)
                return MachineState.TakingTurn
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
