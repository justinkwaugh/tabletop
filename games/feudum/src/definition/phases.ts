import type { HydratedFeudumGameState } from '../model/gameState.js'

/** R-1.4, R-2.2 The phases history groups a game by; the epoch names them beside this. */
export enum PhaseName {
    Setup = 'Setup',
    HandSelection = 'HandSelection',
    Cards = 'Cards',
    Nourish = 'Nourish',
    Progress = 'Progress',
    Dawn = 'Dawn',
    FinalScoring = 'FinalScoring'
}

/** R-2.2 Closes whichever phase is open and opens the next, for history. */
export function beginPhase(state: HydratedFeudumGameState, name: PhaseName): void {
    const { phaseManager, actionCount } = state
    if (phaseManager.currentPhase) {
        phaseManager.endPhase(actionCount)
    }
    phaseManager.startPhase(name, actionCount)
}
