import { GameEndReason, MachineState } from '@tabletop/reef-encounter'

const Activities: Partial<Record<MachineState, (self: boolean) => string>> = {
    [MachineState.ChoosingParrotfishPolyp]: (self) =>
        self
            ? 'are feeding one of your polyps to your parrotfish.'
            : 'is feeding one of their polyps to their parrotfish.',
    [MachineState.ChoosingLarvaCubes]: (self) => `${self ? 'are' : 'is'} taking two larva cubes.`,
    [MachineState.TakingTurn]: (self) => (self ? 'are taking your turn.' : 'is taking their turn.'),
    [MachineState.FinalTurns]: (self) =>
        self
            ? 'are taking a final turn, in which you may eat one coral.'
            : 'is taking a final turn, in which they may eat one coral.'
}

// The subject is a player's name, or "You" for the viewer.
export function waitingActivity(machineState: MachineState, self: boolean): string | undefined {
    return Activities[machineState]?.(self)
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
