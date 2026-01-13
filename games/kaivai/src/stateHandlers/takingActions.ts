import {
    type HydratedAction,
    type MachineStateHandler,
    ActionSource,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedKaivaiGameState } from '../model/gameState.js'
import { PhaseName } from '../definition/phases.js'
import { HydratedBuild, isBuild } from '../actions/build.js'
import { HydratedPass, isPass, Pass } from '../actions/pass.js'
import { HydratedFish, isFish } from '../actions/fish.js'
import { HydratedDeliver, isDeliver } from '../actions/deliver.js'
import { HydratedCelebrate, isCelebrate } from '../actions/celebrate.js'
import { HydratedIncrease, isIncrease } from '../actions/increase.js'
import { HydratedMove, isMove } from '../actions/move.js'
import { LoseValue } from '../actions/loseValue.js'
import { nanoid } from 'nanoid'
import { isSacrifice } from '../actions/sacrifice.js'

// Transition from TakingActions(Build) -> Building | TakingActions
//                 TakingActions(Fish) -> Fishing | TakingActions
//                 TakingActions(Deliver) -> Delivering | TakingActions
//                 TakingActions(Celebrate) -> TakingActions
//                 TakingActions(Increase) -> TakingActions
//                 TakingActions(Move) -> Moving | TakingActions
//                 TakingActions(Pass) -> TakingActions | LosingValue
//                 TakingActions(Sacrifice) -> TakingActions | LosingValue

type TakingActionsAction =
    | HydratedBuild
    | HydratedFish
    | HydratedDeliver
    | HydratedCelebrate
    | HydratedIncrease
    | HydratedMove
    | HydratedPass

export class TakingActionsStateHandler implements MachineStateHandler<TakingActionsAction, HydratedKaivaiGameState> {
    isValidAction(action: HydratedAction, _context: MachineContext<HydratedKaivaiGameState>): action is TakingActionsAction {
        if (!action.playerId) return false
        return (
            action.type === ActionType.Build ||
            action.type === ActionType.Fish ||
            action.type === ActionType.Deliver ||
            action.type === ActionType.Celebrate ||
            action.type === ActionType.Increase ||
            action.type === ActionType.Move ||
            action.type === ActionType.Pass ||
            action.type === ActionType.Sacrifice
        )
    }

    validActionsForPlayer(playerId: string, context: MachineContext<HydratedKaivaiGameState>): ActionType[] {
        const gameState = context.gameState
        const playerState = gameState.getPlayerState(playerId)

        // If player has not taken a turn this phase, they could sacrifice instead of pass

        const currentPhaseStart = gameState.phases.currentPhase?.start ?? 0
        const passOrSacrifice = gameState.turnManager.hadTurnSinceAction(
            playerId,
            currentPhaseStart
        )
            ? ActionType.Pass
            : ActionType.Sacrifice

        const validActions = [passOrSacrifice]

        // First figure out which are affordable by influence as that is an easy filter
        const actions = [
            ActionType.Build,
            ActionType.Fish,
            ActionType.Deliver,
            ActionType.Celebrate,
            ActionType.Increase,
            ActionType.Move
        ].filter((action) => {
            if (playerState.influence < gameState.influence[action]) {
                return false
            }

            // Basic check for minimum money and tiles to build
            if (
                action === ActionType.Build &&
                (playerState.money() < playerState.buildingCost + 1 || playerState.tiles === 0)
            ) {
                return false
            }

            // Have to have fish to deliver
            if (action === ActionType.Deliver && playerState.numFish() === 0) {
                return false
            }

            return true
        })

        for (const action of actions) {
            switch (action) {
                case ActionType.Celebrate: {
                    if (gameState.board.getCelebratableCells().length > 0) {
                        validActions.push(ActionType.Celebrate)
                    }
                    break
                }
                case ActionType.Increase: {
                    if (HydratedIncrease.isValidIncrease(gameState, playerId)) {
                        validActions.push(ActionType.Increase)
                    }
                    break
                }
                case ActionType.Build:
                case ActionType.Fish:
                case ActionType.Deliver:
                case ActionType.Move: {
                    for (const boatId of Object.keys(playerState.boatLocations)) {
                        if (
                            !validActions.includes(ActionType.Build) &&
                            actions.includes(ActionType.Build) &&
                            HydratedBuild.canBoatBuild({ gameState, playerState, boatId })
                        ) {
                            validActions.push(ActionType.Build)
                        }

                        if (
                            !validActions.includes(ActionType.Fish) &&
                            actions.includes(ActionType.Fish) &&
                            HydratedFish.canBoatFish({ gameState, playerState, boatId })
                        ) {
                            validActions.push(ActionType.Fish)
                        }

                        if (
                            !validActions.includes(ActionType.Deliver) &&
                            actions.includes(ActionType.Deliver) &&
                            HydratedDeliver.canBoatDeliver({ gameState, playerState, boatId })
                        ) {
                            validActions.push(ActionType.Deliver)
                        }

                        if (
                            !validActions.includes(ActionType.Move) &&
                            actions.includes(ActionType.Move) &&
                            HydratedMove.canBoatMove({ gameState, playerState, boatId })
                        ) {
                            validActions.push(ActionType.Move)
                        }

                        // if all of the actions are valid that could be tested, stop
                        if (
                            (!actions.includes(ActionType.Build) ||
                                validActions.includes(ActionType.Build)) &&
                            (!actions.includes(ActionType.Fish) ||
                                validActions.includes(ActionType.Fish)) &&
                            (!actions.includes(ActionType.Deliver) ||
                                validActions.includes(ActionType.Deliver)) &&
                            (!actions.includes(ActionType.Move) ||
                                validActions.includes(ActionType.Move))
                        ) {
                            break
                        }
                    }
                    break
                }
            }
        }
        return validActions
    }

    enter(context: MachineContext<HydratedKaivaiGameState>) {
        const gameState = context.gameState

        let nextPlayerId
        if (!gameState.phases.currentPhase) {
            gameState.phases.startPhase(PhaseName.TakingActions, gameState.actionCount)
            nextPlayerId = gameState.turnManager.restartTurnOrder(gameState.actionCount)
        } else {
            nextPlayerId = gameState.turnManager.startNextTurn(
                gameState.actionCount,
                (playerId: string) => {
                    return !gameState.passedPlayers.includes(playerId)
                }
            )
        }

        if (nextPlayerId) {
            gameState.activePlayerIds = [nextPlayerId]
            const playerState = gameState.getPlayerState(nextPlayerId)
            playerState.availableBoats = Object.keys(playerState.boatLocations)

            const validActions = this.validActionsForPlayer(nextPlayerId, context)
            if (validActions.length === 1 && validActions[0] === ActionType.Pass) {
                context.addSystemAction(Pass, { playerId: nextPlayerId })
            }
        }
    }

    onAction(action: TakingActionsAction, context: MachineContext<HydratedKaivaiGameState>): MachineState {
        const gameState = context.gameState
        const playerState = gameState.getPlayerState(action.playerId)

        switch (true) {
            case isBuild(action): {
                if (
                    playerState.tiles > 0 &&
                    playerState.availableBoats.some((boatId) =>
                        HydratedBuild.canBoatBuild({ gameState, playerState, boatId })
                    )
                ) {
                    return MachineState.Building
                } else {
                    gameState.turnManager.endTurn(gameState.actionCount)
                    return MachineState.TakingActions
                }
            }
            case isFish(action): {
                if (
                    playerState.availableBoats.some((boatId) =>
                        HydratedFish.canBoatFish({ gameState, playerState, boatId })
                    )
                ) {
                    return MachineState.Fishing
                } else {
                    gameState.turnManager.endTurn(gameState.actionCount)
                    return MachineState.TakingActions
                }
            }
            case isDeliver(action): {
                if (
                    playerState.availableBoats.some((boatId) =>
                        HydratedDeliver.canBoatDeliver({ gameState, playerState, boatId })
                    )
                ) {
                    return MachineState.Delivering
                } else {
                    gameState.turnManager.endTurn(gameState.actionCount)
                    return MachineState.TakingActions
                }
            }
            case isMove(action): {
                if (
                    playerState.availableBoats.some((boatId) =>
                        HydratedMove.canBoatMove({ gameState, playerState, boatId })
                    )
                ) {
                    return MachineState.Moving
                } else {
                    gameState.turnManager.endTurn(gameState.actionCount)
                    return MachineState.TakingActions
                }
            }
            case isCelebrate(action) ||
                isIncrease(action) ||
                isPass(action) ||
                isSacrifice(action): {
                if (isPass(action) || isSacrifice(action)) {
                    gameState.passedPlayers.push(action.playerId)
                }
                gameState.turnManager.endTurn(gameState.actionCount)
                if (gameState.passedPlayers.length === gameState.players.length) {
                    gameState.phases.endPhase(gameState.actionCount)
                    gameState.passedPlayers = []

                    context.addSystemAction(LoseValue)
                    return MachineState.LosingValue
                } else {
                    return MachineState.TakingActions
                }
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
