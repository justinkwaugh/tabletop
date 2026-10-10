import { GameEndReason, MachineState } from '@tabletop/reef-encounter'

const Activities: Partial<Record<MachineState, string>> = {
    [MachineState.ChoosingParrotfishPolyp]: 'is feeding one of their polyps to their parrotfish.',
    [MachineState.ChoosingLarvaCubes]: 'is taking two larva cubes.',
    [MachineState.TakingTurn]: 'is taking their turn.',
    [MachineState.FinalTurns]: 'is taking a final turn, in which they may eat one coral.'
}

export function waitingActivity(machineState: MachineState): string | undefined {
    return Activities[machineState]
}

const EndReasons: Record<GameEndReason, string> = {
    [GameEndReason.AllTilesLocked]: 'The game ended when the last coral tile was locked.',
    [GameEndReason.FourShrimpsEaten]: 'The game ended when a parrotfish ate its fourth shrimp.',
    [GameEndReason.NoRockLeft]: 'The game ended when no rock was left to grow on.',
    [GameEndReason.Shortage]: 'The game ended when the open sea could not be refilled.'
}

export function endReasonText(reason: GameEndReason | undefined): string | undefined {
    return reason ? EndReasons[reason] : undefined
}
