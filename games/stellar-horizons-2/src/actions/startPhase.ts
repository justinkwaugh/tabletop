import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { TurnPhase } from '../model/turn.js'
import { currentPhase } from '../model/turnPlan.js'
import { selfRepair } from '../model/building.js'

export type PhaseMetadata = Type.Static<typeof PhaseMetadata>
export const PhaseMetadata = Type.Object({
    phase: Type.Enum(TurnPhase),
    // Self Repair System's free repairs at the start of the build phase.
    repairedShipIds: Type.Optional(Type.Array(Type.String()))
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
        const phase = currentPhase(state)
        const repairedShipIds = phase === TurnPhase.Build ? selfRepair(state, this.playerId) : []
        this.metadata = repairedShipIds.length > 0 ? { phase, repairedShipIds } : { phase }
    }
}
