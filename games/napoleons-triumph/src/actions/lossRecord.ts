import * as Type from 'typebox'
import { Face } from '../components/pieces.js'
import type { CombatOutcome } from '../model/attackFlow.js'

/** A unit's step loss as history shows it; the face is the unit as it stood before the loss. */
export type LossEntry = Type.Static<typeof LossEntry>
export const LossEntry = Type.Object({
    unitId: Type.String(),
    steps: Type.Integer(),
    eliminated: Type.Boolean(),
    face: Face
})

/** What an action that resolves part of an attack did, for history and the battle display. */
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

export function combatMetadata(outcome: CombatOutcome | undefined, initialResult?: number): CombatMetadata {
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
