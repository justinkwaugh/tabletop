import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { HydratedDeclareBlockade, isDeclareBlockade } from '../actions/declareBlockade.js'
import { HydratedDiscardEscalation, isDiscardEscalation } from '../actions/discardEscalation.js'
import { HydratedEndBlockades, isEndBlockades } from '../actions/endBlockades.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { dropIdleBlockaders } from '../model/blockades.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { type ConversionAction, conversionActions, isConversion } from './conversions.js'
import { stateAfterBlockades } from './transitions.js'

type BlockadingAction =
    HydratedDeclareBlockade | HydratedEndBlockades | HydratedDiscardEscalation | ConversionAction

// Rulebook 4.4 and 4.6: on the Main Line in reverse initiative order, each Player who can
// blockade declares their blockades, one system at a time, then ends their turn. Military
// Academy's discard comes straight after the draw.
export class BlockadingStateHandler implements MachineStateHandler<
    BlockadingAction,
    HydratedStellarHorizonsGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedStellarHorizonsGameState>
    ): action is BlockadingAction {
        return (
            isDeclareBlockade(action) ||
            isEndBlockades(action) ||
            isDiscardEscalation(action) ||
            isConversion(action)
        )
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): ActionType[] {
        const state = context.gameState
        if (!state.isActivePlayer(playerId)) {
            return []
        }
        if (state.escalationDiscard?.playerId === playerId) {
            return [ActionType.DiscardEscalation]
        }
        return [
            ActionType.DeclareBlockade,
            ActionType.EndBlockades,
            ...conversionActions(state, playerId)
        ]
    }

    enter(context: MachineContext<HydratedStellarHorizonsGameState>) {
        context.gameState.activePlayerIds = context.gameState.remainingBlockaders.slice(0, 1)
    }

    onAction(
        _action: BlockadingAction,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): MachineState {
        const state = context.gameState
        dropIdleBlockaders(state)
        return state.remainingBlockaders.length > 0
            ? MachineState.Blockading
            : stateAfterBlockades(state)
    }
}
