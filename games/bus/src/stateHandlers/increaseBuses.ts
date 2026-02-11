import {
    type HydratedAction,
    type MachineStateHandler,
    assert,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { AddBus, HydratedAddBus, isAddBus } from '../actions/addBus.js'
import { HydratedBusGameState } from '../model/gameState.js'
import { HydratedPass, isPass, Pass, PassReason } from '../actions/pass.js'

type IncreaseBusesAction = HydratedAddBus | HydratedPass

export class IncreaseBusesStateHandler implements MachineStateHandler<
    IncreaseBusesAction,
    HydratedBusGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedBusGameState>
    ): action is IncreaseBusesAction {
        // Leave this comment if you want the template to generate code for valid actions
        return isAddBus(action) || isPass(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedBusGameState>
    ): ActionType[] {
        const gameState = context.gameState

        const validActions = []

        if (HydratedAddBus.canAddBus(gameState, playerId)) {
            validActions.push(ActionType.AddBus)
        } else {
            validActions.push(ActionType.Pass)
        }
        // Leave this comment if you want the template to generate code for valid actions

        return validActions
    }

    enter(context: MachineContext<HydratedBusGameState>) {
        console.log('Entering Increase Buses state')
        const activePlayerId = context.gameState.busAction
        assert(activePlayerId, 'No active player for increase buses')

        context.gameState.turnManager.startTurn(activePlayerId, context.gameState.actionCount)
        context.gameState.activePlayerIds = [activePlayerId]

        if (!HydratedAddBus.canAddBus(context.gameState, activePlayerId)) {
            console.log('Player cannot add bus, automatically passing')
            context.addSystemAction(Pass, {
                playerId: activePlayerId,
                reason: PassReason.CannotAddBus
            })
        } else {
            console.log('Adding bus for player', activePlayerId)
            context.addSystemAction(AddBus, {
                playerId: activePlayerId
            })
        }
    }

    onAction(
        action: IncreaseBusesAction,
        context: MachineContext<HydratedBusGameState>
    ): MachineState {
        switch (true) {
            case isAddBus(action): {
                return this.nextPlayerOrState(context.gameState)
            }
            case isPass(action): {
                return this.nextPlayerOrState(context.gameState)
            }
            // Leave this comment if you want the template to generate code for valid actions
            default: {
                throw Error('Invalid action type')
            }
        }
    }

    nextPlayerOrState(state: HydratedBusGameState): MachineState {
        state.busAction = undefined
        state.turnManager.endTurn(state.actionCount)
        throw new Error('Not implemented: handle pass action for increase buses')
    }
}
