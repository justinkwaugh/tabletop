import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { anomalyDefinition } from '../components/anomalies.js'
import {
    AnomalyResolution,
    resolveNextAnomalyAttempt,
    usesAnomalyRewards
} from '../model/anomalies.js'
import { GrantedReward, TurnedOver, grantReward, turnOver } from '../model/anomalyRewards.js'
import { spendPledgedShips, takePact } from '../model/holds.js'
import { grantPactShares } from '../model/pactResolution.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'

export type ResolveAnomalyMetadata = Type.Static<typeof ResolveAnomalyMetadata>
export const ResolveAnomalyMetadata = Type.Object({
    ...AnomalyResolution.properties,
    reward: Type.Optional(GrantedReward),
    shares: Type.Optional(Type.Array(GrantedReward)),
    keeperId: Type.Optional(Type.String()),
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
        if (resolution.pactId !== undefined) {
            this.metadata = this.resolvePact(state, resolution)
            return
        }
        if (!resolution.resolved || !usesAnomalyRewards(state)) {
            this.metadata = resolution
            return
        }
        const { playerId, systemId, anomalyId } = resolution
        const reward = grantReward(state, playerId, anomalyDefinition(anomalyId).reward)
        if (reward.settlements > 0) {
            state.settlementRewards.push({
                playerId,
                anomalyId,
                systemId,
                settlements: reward.settlements
            })
        }
        this.metadata = { ...resolution, reward, turnedOver: turnOver(state, systemId) }
    }

    // A pact spends its partners' pledged ships and, if it resolved the anomaly, splits the
    // reward as agreed; in These are the Voyages its keeper takes the tile.
    private resolvePact(
        state: HydratedStellarHorizonsGameState,
        resolution: AnomalyResolution
    ): ResolveAnomalyMetadata {
        assertExists(resolution.pactId, 'A pact attempt names its pact')
        const candidate = takePact(state, resolution.pactId)
        spendPledgedShips(state, candidate)
        if (!resolution.resolved) {
            return resolution
        }
        if (!usesAnomalyRewards(state)) {
            const keeperId = candidate.terms.keeperId
            assertExists(keeperId, 'A pact without rewards names who keeps the tile')
            state.systemState(resolution.systemId).anomaly = undefined
            state.getPlayerState(keeperId).anomalies.push(resolution.anomalyId)
            return { ...resolution, keeperId }
        }
        const shares = grantPactShares(state, candidate)
        return { ...resolution, shares, turnedOver: turnOver(state, resolution.systemId) }
    }
}
