import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedPlaceMaster, isPlaceMaster } from '../actions/placeMaster.js'
import { HydratedBeginJourney, isBeginJourney } from '..//actions/beginJourney.js'
import { HydratedRecruitStudents, isRecruitStudents } from '../actions/recruitStudents.js'
import { HydratedBridgesGameState } from '../model/gameState.js'
import { MasterType } from '../definition/masterType.js'
import { Placement } from '../components/gameBoard.js'
import { HydratedPass, isPass } from '../actions/pass.js'

type StartOfTurnAction =
    | HydratedPlaceMaster
    | HydratedBeginJourney
    | HydratedRecruitStudents
    | HydratedPass

// Transition from StartOfTurn(PlaceMaster) -> StartOfTurn
//                 StartOfTurn(RecruitStudents) -> RecruitingStudents
//                 StartOfTurn(BeginJourney) -> StartOfTurn | EndOfGame
//                 StartOfTurn(Pass) -> StartOfTurn
export class StartOfTurnStateHandler implements MachineStateHandler<StartOfTurnAction, HydratedBridgesGameState> {
    isValidAction(action: HydratedAction, context: MachineContext<HydratedBridgesGameState>): action is StartOfTurnAction {
        if (!action.playerId) return false
        return this.isValidActionType(action.type, action.playerId, context) || isPass(action)
    }

    validActionsForPlayer(playerId: string, context: MachineContext<HydratedBridgesGameState>): ActionType[] {
        const actions = [
            ActionType.PlaceMaster,
            ActionType.RecruitStudents,
            ActionType.BeginJourney
        ].filter((actionType) => this.isValidActionType(actionType, playerId, context))

        if (!actions.length) {
            actions.push(ActionType.Pass)
        }
        return actions
    }

    enter(context: MachineContext<HydratedBridgesGameState>) {
        const gameState = context.gameState

        const nextPlayerId = gameState.turnManager.startNextTurn(gameState.actionCount)
        gameState.activePlayerIds = [nextPlayerId]
    }

    onAction(action: StartOfTurnAction, context: MachineContext<HydratedBridgesGameState>): MachineState {
        const gameState = context.gameState

        switch (true) {
            case isPlaceMaster(action) || isPass(action): {
                gameState.turnManager.endTurn(gameState.actionCount)
                return MachineState.StartOfTurn
            }
            case isRecruitStudents(action): {
                if (this.isValidActionType(ActionType.RecruitStudents, action.playerId, context)) {
                    return MachineState.RecruitingStudents
                } else {
                    action.metadata = { forceSkip: true }
                    gameState.turnManager.endTurn(gameState.actionCount)
                    return MachineState.StartOfTurn
                }
            }
            case isBeginJourney(action): {
                gameState.turnManager.endTurn(gameState.actionCount)
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
        context: MachineContext<HydratedBridgesGameState>
    ): boolean {
        const gameState = context.gameState
        const playerState = gameState.getPlayerState(playerId)

        switch (actionType) {
            case ActionType.PlaceMaster: {
                for (let village = 0; village < gameState.board.villages.length; village++) {
                    for (const masterType of Object.values(MasterType)) {
                        if (!playerState.hasPiece(masterType)) {
                            continue
                        }
                        const placement: Placement = { masterType, village }
                        const { valid } = HydratedPlaceMaster.isValidPlacement(
                            gameState,
                            playerId,
                            placement
                        )
                        if (valid) {
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
                        const { valid } = HydratedRecruitStudents.isValidPlacement(
                            gameState,
                            playerId,
                            placement
                        )
                        if (valid) {
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
                    const { valid } = HydratedBeginJourney.isValidSourceVillage(
                        gameState,
                        playerId,
                        sourceIndex
                    )
                    if (!valid) {
                        continue
                    }
                    const sourceVillage = gameState.board.villages[sourceIndex]
                    for (const neighborIndex of sourceVillage.neighbors) {
                        const { valid } = HydratedBeginJourney.isValidDestinationVillage(
                            gameState,
                            sourceIndex,
                            neighborIndex
                        )
                        if (valid) {
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
