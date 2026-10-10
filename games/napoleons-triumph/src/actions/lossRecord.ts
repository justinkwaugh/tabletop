import * as Type from 'typebox'
import { LossEntry } from '../model/attack.js'
import type { CombatOutcome } from '../model/attackResolution.js'

export type CombatMetadata = Type.Static<typeof CombatMetadata>
export const CombatMetadata = Type.Object({
    losses: Type.Array(LossEntry),
    initialResult: Type.Optional(Type.Integer()),
    finalResult: Type.Optional(Type.Integer()),
    attackerWon: Type.Optional(Type.Boolean()),
    loserId: Type.Optional(Type.String()),
    moraleLost: Type.Optional(Type.Integer()),
    demoralizedId: Type.Optional(Type.String())
})

export function combatMetadata(
    outcome: CombatOutcome | undefined,
    initialResult?: number
): CombatMetadata {
    return {
        losses: outcome?.losses ?? [],
        initialResult,
        finalResult: outcome?.finalResult,
        attackerWon: outcome?.attackerWon,
        loserId: outcome?.morale?.loserId,
        moraleLost: outcome?.morale?.moraleLost,
        demoralizedId: outcome?.morale?.demoralizedId
    }
}
