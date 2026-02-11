import {
    type HydratedAction,
    type MachineStateHandler,
    assert,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { HydratedAddPassengers, isAddPassengers } from '../actions/addPassengers.js'
import { HydratedBusGameState } from '../model/gameState.js'
import { HydratedPass, isPass, Pass, PassReason } from '../actions/pass.js'
import { getNextActionState } from '../utils/nextActionState.js'

type AddingPassengersAction = HydratedAddPassengers | HydratedPass

export class AddingPassengersStateHandler implements MachineStateHandler<
    AddingPassengersAction,
    HydratedBusGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedBusGameState>
    ): action is AddingPassengersAction {
        // Leave this comment if you want the template to generate code for valid actions
        return isAddPassengers(action) || isPass(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedBusGameState>
    ): ActionType[] {
        const gameState = context.gameState

        const validActions = []

        if (HydratedAddPassengers.canAddPassengers(gameState, playerId)) {
            validActions.push(ActionType.AddPassengers)
        } else {
            validActions.push(ActionType.Pass)
        }
        // Leave this comment if you want the template to generate code for valid actions

        return validActions
    }

    enter(context: MachineContext<HydratedBusGameState>) {
        const activePlayerId = context.gameState.passengersAction.at(0)
        assert(activePlayerId, 'No active player for passengers')

        if (!context.gameState.actionsTaken) {
            console.log('Starting passengers turn for player', activePlayerId)
            context.gameState.turnManager.startTurn(activePlayerId, context.gameState.actionCount)
            context.gameState.activePlayerIds = [activePlayerId]
        }

        const numAllowedActions = this.calculateNumActions(context.gameState)
        console.log('calculated num actions for passengers', numAllowedActions)
        if (
            numAllowedActions === 0 ||
            !HydratedAddPassengers.canAddPassengers(context.gameState, activePlayerId)
        ) {
            context.addSystemAction(Pass, {
                playerId: activePlayerId,
                reason: PassReason.CannotAddPassenger
            })
        }
    }

    onAction(
        action: AddingPassengersAction,
        context: MachineContext<HydratedBusGameState>
    ): MachineState {
        const state = context.gameState
        switch (true) {
            case isAddPassengers(action): {
                const numActions = this.calculateNumActions(context.gameState)
                state.actionsTaken += action.numPassengers

                if (
                    state.actionsTaken === numActions ||
                    !HydratedAddPassengers.canAddPassengers(context.gameState, action.playerId)
                ) {
                    return this.nextPlayerOrState(state)
                }

                return MachineState.AddingPassengers
            }
            case isPass(action): {
                return this.nextPlayerOrState(state)
            }
            // Leave this comment if you want the template to generate code for valid actions
            default: {
                throw Error('Invalid action type')
            }
        }
    }

    nextPlayerOrState(state: HydratedBusGameState): MachineState {
        state.passengerTurnsTaken = (state.passengerTurnsTaken ?? 0) + 1
        state.passengersAction.shift()
        state.turnManager.endTurn(state.actionCount)
        state.actionsTaken = 0

        if (state.passengersAction.length === 0) {
            state.passengerTurnsTaken = 0
            return getNextActionState(state)
        }

        return MachineState.AddingPassengers
    }

    calculateNumActions(state: HydratedBusGameState): number {
        const maxBusValue = state.maxBusValue()
        return maxBusValue - (state.passengerTurnsTaken ?? 0)
    }
}
