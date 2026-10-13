import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { TurnPhase } from '../model/turn.js'
import { currentPhase } from '../model/turnPlan.js'

export type PhaseMetadata = Type.Static<typeof PhaseMetadata>
export const PhaseMetadata = Type.Object({
    phase: Type.Enum(TurnPhase)
})

export type StartPhase = Type.Static<typeof StartPhase>
export const StartPhase = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.StartPhase),
            playerId: Type.String(),
            metadata: Type.Optional(PhaseMetadata)
        })
    ])
)

export const StartPhaseValidator = Compile(StartPhase)

export function isStartPhase(action?: GameAction): action is StartPhase {
    return action?.type === ActionType.StartPhase
}

export class HydratedStartPhase extends HydratableAction<typeof StartPhase> implements StartPhase {
    declare type: ActionType.StartPhase
    declare playerId: string
    declare metadata?: PhaseMetadata

    constructor(data: StartPhase) {
        super(data, StartPhaseValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        this.metadata = { phase: currentPhase(state) }
    }
}
