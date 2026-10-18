import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { queuePactAttempts } from '../model/pactResolution.js'
import { TurnPhase } from '../model/turn.js'
import { currentPhase } from '../model/turnPlan.js'
import { PhaseMetadata } from './startPhase.js'

export type CompletePhase = Type.Static<typeof CompletePhase>
export const CompletePhase = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.CompletePhase),
            metadata: Type.Optional(PhaseMetadata)
        })
    ])
)

export const CompletePhaseValidator = Compile(CompletePhase)

export function isCompletePhase(action?: GameAction): action is CompletePhase {
    return action?.type === ActionType.CompletePhase
}

export class HydratedCompletePhase
    extends HydratableAction<typeof CompletePhase>
    implements CompletePhase
{
    declare type: ActionType.CompletePhase
    declare metadata?: PhaseMetadata

    constructor(data: CompletePhase) {
        super(data, CompletePhaseValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        const phase = currentPhase(state)
        if (phase === TurnPhase.Exploration) {
            queuePactAttempts(state)
        }
        this.metadata = { phase }
    }
}
