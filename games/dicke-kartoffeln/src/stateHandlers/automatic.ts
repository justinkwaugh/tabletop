import type * as Type from 'typebox'
import {
    type GameAction,
    type HydratedAction,
    type MachineStateHandler,
    MachineContext
} from '@tabletop/common'
import type { ActionType } from '../definition/actions.js'
import { readSetup } from '../definition/setup.js'
import type { MachineState } from '../definition/states.js'
import type { HydratedDickeKartoffelnGameState } from '../model/gameState.js'
import { nextRound } from './flow.js'

type RoundOptions = { revealsInfo?: boolean }

// A round the rules carry out by themselves: its System Action does the work, then the year
// moves on.
export class AutomaticStateHandler<Action extends HydratedAction> implements MachineStateHandler<
    Action,
    HydratedDickeKartoffelnGameState
> {
    constructor(
        private readonly round: MachineState,
        private readonly schema: Type.TSchema,
        private readonly isRoundAction: (action?: GameAction) => boolean,
        private readonly options: RoundOptions = {}
    ) {}

    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedDickeKartoffelnGameState>
    ): action is Action {
        return this.isRoundAction(action)
    }

    validActionsForPlayer(
        _playerId: string,
        _context: MachineContext<HydratedDickeKartoffelnGameState>
    ): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedDickeKartoffelnGameState>) {
        context.addSystemAction(this.schema, this.options.revealsInfo ? { revealsInfo: true } : {})
    }

    onAction(
        _action: Action,
        context: MachineContext<HydratedDickeKartoffelnGameState>
    ): MachineState {
        return nextRound(context.gameState, readSetup(context.gameConfig), this.round)
    }
}
