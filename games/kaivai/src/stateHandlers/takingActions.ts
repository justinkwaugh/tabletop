import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedKaivaiGameState } from '../model/gameState.js'
import { PhaseName } from '../definition/phases.js'
import { HydratedBuild, isBuild } from '../actions/build.js'
import { HydratedPass } from '../actions/pass.js'
import { HydratedFish, isFish } from '../actions/fish.js'
import { HydratedDeliver, isDeliver } from '../actions/deliver.js'
import { HydratedCelebrate, isCelebrate } from '../actions/celebrate.js'
import { HydratedIncrease, isIncrease } from '../actions/increase.js'

// Transition from TakingActions(Build) -> Building | TakingActions
//                 TakingActions(Fish) -> Fishing | TakingActions
//                 TakingActions(Deliver) -> Delivering | TakingActions
//                 TakingActions(Celebrate) -> TakingActions
//                 TakingActions(Increase) -> TakingActions
//                 TakingActions(Pass) -> TakingActions
//                 TakingActions(Pass) -> LosingValue

type TakingActionsAction =
    | HydratedBuild
    | HydratedFish
    | HydratedDeliver
    | HydratedCelebrate
    | HydratedIncrease
    | HydratedPass

export class TakingActionsStateHandler implements MachineStateHandler<TakingActionsAction> {
    isValidAction(action: HydratedAction, _context: MachineContext): action is TakingActionsAction {
        if (!action.playerId) return false
        return (
            action.type === ActionType.Build ||
            action.type === ActionType.Fish ||
            action.type === ActionType.Deliver ||
            action.type === ActionType.Celebrate ||
            action.type === ActionType.Increase ||
            action.type === ActionType.Pass
        )
    }

    validActionsForPlayer(playerId: string, context: MachineContext): ActionType[] {
        const gameState = context.gameState as HydratedKaivaiGameState
        const playerState = gameState.getPlayerState(playerId)

        const validActions = [ActionType.Pass]

        // First figure out which are affordable by influence as that is an easy filter
        const actions = [
            ActionType.Build,
            ActionType.Fish,
            ActionType.Deliver,
            ActionType.Celebrate,
            ActionType.Increase
        ].filter((action) => {
            if (playerState.influence < gameState.influence[action]) {
                return false
            }

            // Basic check for minimum money to build
            if (action === ActionType.Build && playerState.money() < playerState.buildingCost + 1) {
                return false
            }

            // Have to have fish to deliver
            if (action === ActionType.Deliver && playerState.numFish() === 0) {
                return false
            }

            return true
        })

        console.log('Possible actions', actions)

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
                case ActionType.Deliver: {
                    const playerBoatCoords = Object.values(playerState.boatLocations)
                    console.log(
                        'Player has boats at ',
                        playerBoatCoords.map((coords) => coords.q + ',' + coords.r).join(' ')
                    )
                    for (const boatId of Object.keys(playerState.boatLocations)) {
                        if (
                            !validActions.includes(ActionType.Build) &&
                            actions.includes(ActionType.Build) &&
                            HydratedBuild.canBoatBuild({ gameState, playerState, boatId })
                        ) {
                            console.log('can build')
                            validActions.push(ActionType.Build)
                        }

                        if (
                            !validActions.includes(ActionType.Fish) &&
                            actions.includes(ActionType.Fish) &&
                            HydratedFish.canBoatFish({ gameState, playerState, boatId })
                        ) {
                            console.log('can fish')
                            validActions.push(ActionType.Fish)
                        }

                        if (
                            !validActions.includes(ActionType.Deliver) &&
                            actions.includes(ActionType.Deliver) &&
                            HydratedDeliver.canBoatDeliver({ gameState, playerState, boatId })
                        ) {
                            console.log('can deliver')
                            validActions.push(ActionType.Deliver)
                        }

                        // if all of the actions are valid that could be tested, stop
                        if (
                            (!actions.includes(ActionType.Build) ||
                                validActions.includes(ActionType.Build)) &&
                            (!actions.includes(ActionType.Fish) ||
                                validActions.includes(ActionType.Fish)) &&
                            (!actions.includes(ActionType.Deliver) ||
                                validActions.includes(ActionType.Deliver))
                        ) {
                            break
                        }
                    }
                    break
                }
            }
        }

        console.log('Valid actions', validActions)
        return validActions
    }

    enter(context: MachineContext) {
        const gameState = context.gameState as HydratedKaivaiGameState

        let nextPlayerId
        if (!gameState.phases.currentPhase) {
            gameState.phases.startPhase(PhaseName.TakingActions, gameState.actionCount)
            nextPlayerId = gameState.turnManager.restartTurnOrder(gameState.actionCount)
        } else {
            nextPlayerId = gameState.turnManager.startNextTurn(gameState.actionCount)
        }

        if (nextPlayerId) {
            gameState.activePlayerIds = [nextPlayerId]
            const playerState = gameState.getPlayerState(nextPlayerId)
            playerState.availableBoats = Object.keys(playerState.boatLocations)
        }
    }

    onAction(action: TakingActionsAction, context: MachineContext): MachineState {
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
            case isCelebrate(action) || isIncrease(action): {
                gameState.turnManager.endTurn(gameState.actionCount)
                return MachineState.TakingActions
            }
            default: {
                throw Error('Invalid action type')
            }
        }
    }
}
