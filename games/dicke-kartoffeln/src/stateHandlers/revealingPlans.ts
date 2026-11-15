import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { HydratedRevealPlans, isRevealPlans } from '../actions/revealPlans.js'
import type { ActionType } from '../definition/actions.js'
import { readSetup } from '../definition/setup.js'
import type { MachineState } from '../definition/states.js'
import type { HydratedDickeKartoffelnGameState } from '../model/gameState.js'
import { nextRound } from './flow.js'

export class RevealingPlansStateHandler implements MachineStateHandler<
    HydratedRevealPlans,
    HydratedDickeKartoffelnGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedDickeKartoffelnGameState>
    ): action is HydratedRevealPlans {
        return isRevealPlans(action)
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedDickeKartoffelnGameState>
    ): ActionType[] {
        return []
    }

    enter(_context: MachineContext<HydratedDickeKartoffelnGameState>) {}

    onAction(
        action: HydratedRevealPlans,
        context: MachineContext<HydratedDickeKartoffelnGameState>
    ): MachineState {
        return nextRound(context.gameState, readSetup(context.gameConfig), action.step)
    }
}
