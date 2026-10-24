import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assertExists } from '@tabletop/common'
import { DirectiveType } from '../components/directives.js'
import { ActionType } from '../definition/actions.js'
import { ruledDifficulty } from '../model/directives.js'
import { recordTurnProgress } from '../model/turnRecord.js'
import { FulfilledDirective } from '../model/pieces.js'
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
    turnedOver: Type.Optional(TurnedOver),
    directives: Type.Optional(Type.Array(FulfilledDirective))
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
        const resolverIds = this.resolverIds(state, resolution)
        const metadata = this.resolve(state, resolution)
        const directives = resolution.resolved
            ? this.recordDirectives(state, resolution.anomalyId, resolverIds)
            : []
        this.metadata = directives.length > 0 ? { ...metadata, directives } : metadata
    }

    // Before a pact resolves it is taken from the state; its partners are read first.
    private resolverIds(
        state: HydratedStellarHorizonsGameState,
        resolution: AnomalyResolution
    ): string[] {
        if (resolution.pactId === undefined) {
            return [resolution.playerId]
        }
        const pact = state.pacts.find((candidate) => candidate.id === resolution.pactId)
        assertExists(pact, 'A pact attempt names a pact in play')
        return pact.terms.partnerIds
    }

    // Rulebook 5.1: an anomaly directive counts for each Player who resolved it, alone or in a
    // pact.
    private recordDirectives(
        state: HydratedStellarHorizonsGameState,
        anomalyId: string,
        resolverIds: readonly string[]
    ): FulfilledDirective[] {
        const anomaly = anomalyDefinition(anomalyId)
        const difficulty = ruledDifficulty(
            state,
            anomaly.difficulty,
            anomaly.challenge,
            resolverIds
        )
        return resolverIds.flatMap((playerId) => {
            const fulfilled = recordTurnProgress(state, playerId, {
                kind: DirectiveType.Anomaly,
                challenge: anomaly.challenge,
                difficulty
            })
            return fulfilled ? [fulfilled] : []
        })
    }

    private resolve(
        state: HydratedStellarHorizonsGameState,
        resolution: AnomalyResolution
    ): ResolveAnomalyMetadata {
        if (resolution.pactId !== undefined) {
            return this.resolvePact(state, resolution)
        }
        if (!resolution.resolved || !usesAnomalyRewards(state)) {
            return resolution
        }
        const { playerId, systemId, anomalyId } = resolution
        const reward = grantReward(state, playerId, anomalyDefinition(anomalyId).reward, {
            anomalyId,
            systemId
        })
        return { ...resolution, reward, turnedOver: turnOver(state, systemId) }
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
