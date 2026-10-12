import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { AnomalyResolution, resolveNextAnomalyAttempt } from '../model/anomalies.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'

export type ResolveAnomaly = Type.Static<typeof ResolveAnomaly>
export const ResolveAnomaly = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.ResolveAnomaly),
            metadata: Type.Optional(AnomalyResolution)
        })
    ])
)

export const ResolveAnomalyValidator = Compile(ResolveAnomaly)

export function isResolveAnomaly(action?: GameAction): action is ResolveAnomaly {
    return action?.type === ActionType.ResolveAnomaly
}

export class HydratedResolveAnomaly
    extends HydratableAction<typeof ResolveAnomaly>
    implements ResolveAnomaly
{
    declare type: ActionType.ResolveAnomaly
    declare metadata?: AnomalyResolution

    constructor(data: ResolveAnomaly) {
        super(data, ResolveAnomalyValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        this.metadata = resolveNextAnomalyAttempt(state)
    }
}
