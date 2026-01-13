import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedRecruitStudents, isRecruitStudents } from '../actions/recruitStudents.js'
import { HydratedBridgesGameState } from '../model/gameState.js'
import { MasterType } from '../definition/masterType.js'
import { Placement } from '../components/gameBoard.js'
import { HydratedPass, isPass } from '../actions/pass.js'

type StartOfTurnAction = HydratedRecruitStudents | HydratedPass

// Transition from RecruitStudents(PlaceMaster) -> StartOfTurn
//                 RecruitStudents(Pass) -> StartOfTurn
export class RecruitingStudentsStateHandler implements MachineStateHandler<StartOfTurnAction, HydratedBridgesGameState> {
    isValidAction(action: HydratedAction, context: MachineContext<HydratedBridgesGameState>): action is StartOfTurnAction {
        if (!action.playerId) return false
        return this.isValidActionType(action.type, action.playerId, context)
    }

    validActionsForPlayer(playerId: string, context: MachineContext<HydratedBridgesGameState>): ActionType[] {
        return Object.values(ActionType).filter((actionType) =>
            this.isValidActionType(actionType, playerId, context)
        )
    }

    enter(_context: MachineContext<HydratedBridgesGameState>) {}

    onAction(action: StartOfTurnAction, context: MachineContext<HydratedBridgesGameState>): MachineState {
        const gameState = context.gameState

        switch (true) {
            case isRecruitStudents(action) || isPass(action): {
                if (isPass(action)) {
                    action.metadata = { recruiting: true }
                }
                gameState.turnManager.endTurn(gameState.actionCount)
                return MachineState.StartOfTurn
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }

    private isValidActionType(
        actionType: string,
        playerId: string,
        context: MachineContext<HydratedBridgesGameState>
    ): boolean {
        const gameState = context.gameState
        const playerState = gameState.getPlayerState(playerId)

        switch (actionType) {
            case ActionType.RecruitStudents: {
                if (gameState.turnManager.turnCount(playerId) < 7) {
                    return false
                }
                for (let village = 0; village < gameState.board.villages.length; village++) {
                    for (const masterType of Object.values(MasterType)) {
                        if (!playerState.hasPiece(masterType)) {
                            continue
                        }
                        const placement: Placement = { masterType, village }
                        if (
                            HydratedRecruitStudents.isValidPlacement(gameState, playerId, placement)
                        ) {
                            return true
                        }
                    }
                }
                return false
            }
            case ActionType.Pass: {
                return true
            }
        }
        return false
    }
}
