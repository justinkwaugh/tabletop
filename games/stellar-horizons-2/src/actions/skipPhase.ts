import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { currentPhase } from '../model/turnPlan.js'
import { PhaseMetadata } from './startPhase.js'

export type SkipPhase = Type.Static<typeof SkipPhase>
export const SkipPhase = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.SkipPhase),
            playerId: Type.String(),
            metadata: Type.Optional(PhaseMetadata)
        })
    ])
)

export const SkipPhaseValidator = Compile(SkipPhase)

export function isSkipPhase(action?: GameAction): action is SkipPhase {
    return action?.type === ActionType.SkipPhase
}

export class HydratedSkipPhase extends HydratableAction<typeof SkipPhase> implements SkipPhase {
    declare type: ActionType.SkipPhase
    declare playerId: string
    declare metadata?: PhaseMetadata

    constructor(data: SkipPhase) {
        super(data, SkipPhaseValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        this.metadata = { phase: currentPhase(state) }
    }
}
