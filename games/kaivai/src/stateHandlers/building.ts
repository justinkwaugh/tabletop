import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedKaivaiGameState } from '../model/gameState.js'
import { HydratedBuild, isBuild } from '../actions/build.js'
import { HydratedPass, isPass } from '../actions/pass.js'

// Transition from Building(Build) -> Building | TakingActions
//                 Building(Pass) -> TakingActions

type BuildingAction = HydratedBuild | HydratedPass

export class BuildingStateHandler implements MachineStateHandler<BuildingAction> {
    isValidAction(action: HydratedAction, _context: MachineContext): action is BuildingAction {
        if (!action.playerId) return false
        return action.type === ActionType.Build || action.type === ActionType.Pass
    }

    validActionsForPlayer(playerId: string, context: MachineContext): ActionType[] {
        const gameState = context.gameState as HydratedKaivaiGameState
        const playerState = gameState.getPlayerState(playerId)

        const validActions = [ActionType.Pass]

        // Can still pay
        if (playerState.money() < playerState.buildingCost + 1) {
            return validActions
        }

        // Has another boat to build
        for (const boatId of playerState.availableBoats) {
            console.log('Checking boat', boatId)
            if (HydratedBuild.canBoatBuild({ gameState, playerState, boatId })) {
                console.log('can build')
                validActions.push(ActionType.Build)
                break
            }
        }

        console.log('Valid actions for player', playerId, validActions)
        return validActions
    }

    enter(_context: MachineContext) {}

    onAction(action: BuildingAction, context: MachineContext): MachineState {
        const gameState = context.gameState as HydratedKaivaiGameState
        const playerState = gameState.getPlayerState(action.playerId)

        switch (true) {
            case isBuild(action): {
                if (
                    playerState.availableBoats.some((boatId) =>
                        HydratedBuild.canBoatBuild({ gameState, playerState, boatId })
                    )
                ) {
                    return MachineState.Building
                } else {
                    playerState.availableBoats = []
                    gameState.turnManager.endTurn(gameState.actionCount)
                    return MachineState.TakingActions
                }
            }
            case isPass(action): {
                playerState.availableBoats = []
                gameState.turnManager.endTurn(gameState.actionCount)
                return MachineState.TakingActions
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
