import type { OathGameState } from '../model/gameState.js'

/** Stored games keep the rules they were recorded under; a state without a revision predates them all. */
export enum OathRevision {
    TurnFlow = 1,
    CostsAndFacedownModifiers = 2,
    PlanCostsAndSearchPlays = 3,
    CardFixes1 = 4
}

export const CURRENT_OATH_REVISION = OathRevision.CardFixes1

export function isAtLeastOathRevision(
    state: Pick<OathGameState, 'oathRevision'>,
    revision: OathRevision
): boolean {
    return (state.oathRevision ?? 0) >= revision
}
