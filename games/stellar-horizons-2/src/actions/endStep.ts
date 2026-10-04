import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { TurnStep, nextTurnStep } from '../model/turn.js'

export type EndStep = Type.Static<typeof EndStep>
export const EndStep = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.EndStep),
            playerId: Type.String(),
            step: Type.Enum(TurnStep)
        })
    ])
)

export const EndStepValidator = Compile(EndStep)

export function isEndStep(action?: GameAction): action is EndStep {
    return action?.type === ActionType.EndStep
}

export class HydratedEndStep extends HydratableAction<typeof EndStep> implements EndStep {
    declare type: ActionType.EndStep
    declare playerId: string
    declare step: TurnStep

    constructor(data: EndStep) {
        super(data, EndStepValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        const player = state.getPlayerState(this.playerId)
        if (this.step === TurnStep.Done || player.step !== this.step) {
            throw Error('Invalid EndStep action')
        }
        player.step = nextTurnStep(player.step)
    }

    static canEndStep(state: HydratedStellarHorizonsGameState, playerId: string): boolean {
        return state.getPlayerState(playerId).step !== TurnStep.Done
    }
}
