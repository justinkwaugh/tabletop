import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { TurnPhase } from '../model/turn.js'
import { playPhase } from '../model/turnPlan.js'

export type EndPhase = Type.Static<typeof EndPhase>
export const EndPhase = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.EndPhase),
            playerId: Type.String(),
            phase: Type.Enum(TurnPhase)
        })
    ])
)

export const EndPhaseValidator = Compile(EndPhase)

export function isEndPhase(action?: GameAction): action is EndPhase {
    return action?.type === ActionType.EndPhase
}

export class HydratedEndPhase extends HydratableAction<typeof EndPhase> implements EndPhase {
    declare type: ActionType.EndPhase
    declare playerId: string
    declare phase: TurnPhase

    constructor(data: EndPhase) {
        super(data, EndPhaseValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        if (playPhase(state) !== this.phase) {
            throw Error('Invalid EndPhase action')
        }
    }
}
