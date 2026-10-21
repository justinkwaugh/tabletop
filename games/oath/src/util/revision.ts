import type { OathGameState } from '../model/gameState.js'

/** Stored games keep the rules they were recorded under; a state without a revision predates them all. */
export enum OathRevision {
    TurnFlow = 1,
    CostsAndFacedownModifiers = 2,
    PlanCostsAndSearchPlays = 3,
    CardFixes1 = 4,
    EngineFixes2 = 5,
    UiBatch1 = 6,
    EngineFixes3 = 7,
    EngineFixes4 = 8,
    EngineFixes5 = 9,
    EngineFixes6 = 10,
    EngineFixes7 = 11,
    EngineFixes8 = 12,
    EngineFixes9 = 13,
    EngineFixes10 = 14,
    EngineFixes11 = 15,
    EngineFixes12 = 16
}

export const CURRENT_OATH_REVISION = OathRevision.EngineFixes12

export function isAtLeastOathRevision(
    state: Pick<OathGameState, 'oathRevision'>,
    revision: OathRevision
): boolean {
    return (state.oathRevision ?? 0) >= revision
}
