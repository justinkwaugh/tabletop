import type { OathGameState } from '../model/gameState.js'

/** Stored games keep the rules they were recorded under; a state without a revision predates them all. */
export enum OathRevision {
    TurnFlow = 1,
    CostsAndFacedownModifiers = 2,
    PlanCostsAndSearchPlays = 3,
    CardFixes1 = 4,
    EngineFixes2 = 5
}

export const CURRENT_OATH_REVISION = OathRevision.EngineFixes2

export function isAtLeastOathRevision(
    state: Pick<OathGameState, 'oathRevision'>,
    revision: OathRevision
): boolean {
    return (state.oathRevision ?? 0) >= revision
}
