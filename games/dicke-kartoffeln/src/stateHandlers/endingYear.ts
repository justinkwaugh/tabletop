import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { EndYear, HydratedEndYear, isEndYear } from '../actions/endYear.js'
import type { ActionType } from '../definition/actions.js'
import { readSetup } from '../definition/setup.js'
import { MachineState } from '../definition/states.js'
import type { HydratedDickeKartoffelnGameState } from '../model/gameState.js'
import { nextRound } from './flow.js'

export class EndingYearStateHandler implements MachineStateHandler<
    HydratedEndYear,
    HydratedDickeKartoffelnGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedDickeKartoffelnGameState>
    ): action is HydratedEndYear {
        return isEndYear(action)
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedDickeKartoffelnGameState>
    ): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedDickeKartoffelnGameState>) {
        context.addSystemAction(EndYear, {})
    }

    onAction(
        action: HydratedEndYear,
        context: MachineContext<HydratedDickeKartoffelnGameState>
    ): MachineState {
        if (action.metadata?.final) {
            return MachineState.FinalScoring
        }
        return nextRound(context.gameState, readSetup(context.gameConfig))
    }
}
