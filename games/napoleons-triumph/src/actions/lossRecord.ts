import * as Type from 'typebox'
import { LossEntry, MoralePenalty, ResultTerm } from '../model/attack.js'
import type { CombatOutcome } from '../model/attackResolution.js'

export type CombatMetadata = Type.Static<typeof CombatMetadata>
export const CombatMetadata = Type.Object({
    losses: Type.Array(LossEntry),
    penalties: Type.Optional(Type.Array(MoralePenalty)),
    initialResult: Type.Optional(Type.Integer()),
    /** What the result this action settled is made of: the initial result for a declaration, the counter-attack for a counter-attack. */
    account: Type.Optional(Type.Array(ResultTerm)),
    finalResult: Type.Optional(Type.Integer()),
    attackerWon: Type.Optional(Type.Boolean()),
    loserId: Type.Optional(Type.String()),
    moraleLost: Type.Optional(Type.Integer()),
    demoralizedId: Type.Optional(Type.String())
})

export function combatMetadata(
    outcome: CombatOutcome | undefined,
    initialResult?: number,
    account?: ResultTerm[]
): CombatMetadata {
    return {
        losses: outcome?.losses ?? [],
        penalties: outcome?.penalties ?? [],
        initialResult,
        account,
        finalResult: outcome?.finalResult,
        attackerWon: outcome?.attackerWon,
        loserId: outcome?.morale?.loserId,
        moraleLost: outcome?.morale?.moraleLost,
        demoralizedId: outcome?.morale?.demoralizedId
    }
}
