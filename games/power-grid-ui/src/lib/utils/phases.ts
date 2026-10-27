import { MachineState } from '@tabletop/power-grid'

export const PHASES = ['Player order', 'Auction', 'Resources', 'Building', 'Bureaucracy'] as const

/** The rulebook's phase number (1–5) for a machine state; 0 once the game is over. */
export function phaseNumber(state: MachineState): number {
    switch (state) {
        case MachineState.ChoosingPlant:
        case MachineState.Bidding:
        case MachineState.ReplacingPlant:
        case MachineState.ScrappingPlant:
        case MachineState.ClosingAuctions:
        case MachineState.TrustTakingPlant:
            return 2
        case MachineState.BuyingResources:
        case MachineState.TrustBuying:
            return 3
        case MachineState.Building:
            return 4
        case MachineState.StartingStep2:
        case MachineState.Powering:
        case MachineState.Restocking:
            return 5
        case MachineState.PlacingTrust:
        case MachineState.EndOfGame:
            return 0
    }
}
