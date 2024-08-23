import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedPlaceMaster, isPlaceMaster } from '../actions/placeMaster.js'
import { HydratedBeginJourney, isBeginJourney } from '..//actions/beginJourney.js'
import { HydratedRecruitStudents, isRecruitStudents } from '../actions/recruitStudents.js'
import { HydratedBridgesGameState } from '../model/gameState.js'
import { MasterType } from '../definition/masterType.js'
import { Placement } from '../components/gameBoard.js'

type StartOfTurnAction = HydratedPlaceMaster | HydratedBeginJourney | HydratedRecruitStudents

// Transition from StartOfTurn(PlaceMaster) -> StartOfTurn
//                 StartOfTurn(RecruitStudents) -> RecruitingStudents
//                 StartOfTurn(BeginJourney) -> StartOfTurn | EndOfGame
export class StartOfTurnStateHandler implements MachineStateHandler<StartOfTurnAction> {
    isValidAction(action: HydratedAction, context: MachineContext): action is StartOfTurnAction {
        if (!action.playerId) return false
        return this.isValidActionType(action.type, action.playerId, context)
    }

    validActionsForPlayer(playerId: string, context: MachineContext): ActionType[] {
        return Object.values(ActionType).filter((actionType) =>
            this.isValidActionType(actionType, playerId, context)
        )
    }

    enter(context: MachineContext) {
        const gameState = context.gameState as HydratedBridgesGameState

        const nextPlayerId = gameState.turnManager.startNextTurn(gameState.actionCount)
        gameState.activePlayerIds = [nextPlayerId]
    }

    onAction(action: StartOfTurnAction, context: MachineContext): MachineState {
        const gameState = context.gameState as HydratedBridgesGameState

        switch (true) {
            case isPlaceMaster(action): {
                gameState.turnManager.endTurn(gameState.actionCount + 1)
                return MachineState.StartOfTurn
            }
            case isRecruitStudents(action): {
                if (this.isValidActionType(ActionType.RecruitStudents, action.playerId, context)) {
                    return MachineState.RecruitingStudents
                } else {
                    gameState.turnManager.endTurn(gameState.actionCount + 1)
                    return MachineState.StartOfTurn
                }
            }
            case isBeginJourney(action): {
                gameState.turnManager.endTurn(gameState.actionCount + 1)
                if (!gameState.hasStones()) {
                    return MachineState.EndOfGame
                } else {
                    return MachineState.StartOfTurn
                }
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }

    private isValidActionType(
        actionType: string,
        playerId: string,
        context: MachineContext
    ): boolean {
        const gameState = context.gameState as HydratedBridgesGameState
        const playerState = gameState.getPlayerState(playerId)

        switch (actionType) {
            case ActionType.PlaceMaster: {
                for (let village = 0; village < gameState.board.villages.length; village++) {
                    for (const masterType of Object.values(MasterType)) {
                        if (!playerState.hasPiece(masterType)) {
                            continue
                        }
                        const placement: Placement = { masterType, village }
                        if (HydratedPlaceMaster.isValidPlacement(gameState, playerId, placement)) {
                            return true
                        }
                    }
                }
                return false
            }
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
            case ActionType.BeginJourney: {
                if (gameState.turnManager.turnCount(playerId) < 7) {
                    return false
                }
                for (
                    let sourceIndex = 0;
                    sourceIndex < gameState.board.villages.length;
                    sourceIndex++
                ) {
                    if (
                        !HydratedBeginJourney.isValidSourceVillage(gameState, playerId, sourceIndex)
                    ) {
                        continue
                    }
                    const sourceVillage = gameState.board.villages[sourceIndex]
                    for (const neighborIndex of sourceVillage.neighbors) {
                        if (
                            HydratedBeginJourney.isValidDestinationVillage(
                                gameState,
                                sourceIndex,
                                neighborIndex
                            )
                        ) {
                            return true
                        }
                    }
                }
                return false
            }
        }
        return false
    }
}
