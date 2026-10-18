import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { anomalyDefinition } from '../components/anomalies.js'
import {
    AnomalyResolution,
    resolveNextAnomalyAttempt,
    usesAnomalyRewards
} from '../model/anomalies.js'
import { GrantedReward, TurnedOver, grantReward, turnOver } from '../model/anomalyRewards.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'

export type ResolveAnomalyMetadata = Type.Static<typeof ResolveAnomalyMetadata>
export const ResolveAnomalyMetadata = Type.Object({
    ...AnomalyResolution.properties,
    reward: Type.Optional(GrantedReward),
    turnedOver: Type.Optional(TurnedOver)
})

export type ResolveAnomaly = Type.Static<typeof ResolveAnomaly>
export const ResolveAnomaly = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.ResolveAnomaly),
            metadata: Type.Optional(ResolveAnomalyMetadata)
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
    declare metadata?: ResolveAnomalyMetadata

    constructor(data: ResolveAnomaly) {
        super(data, ResolveAnomalyValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        const resolution = resolveNextAnomalyAttempt(state)
        if (!resolution.resolved || !usesAnomalyRewards(state)) {
            this.metadata = resolution
            return
        }
        const { playerId, systemId, anomalyId } = resolution
        const reward = grantReward(state, playerId, anomalyDefinition(anomalyId).reward)
        if (reward.settlements > 0) {
            state.settlementReward = { playerId, systemId, settlements: reward.settlements }
        }
        this.metadata = { ...resolution, reward, turnedOver: turnOver(state, systemId) }
    }
}
