import { MachineState } from '@tabletop/reef-encounter'

const Activities: Partial<Record<MachineState, string>> = {
    [MachineState.ChoosingParrotfishPolyp]: 'is feeding one of their polyps to their parrotfish.',
    [MachineState.ChoosingLarvaCubes]: 'is taking two larva cubes.',
    [MachineState.TakingTurn]: 'is taking their turn.',
    [MachineState.FinalTurns]: 'is taking a final turn, in which they may eat one coral.'
}

export function waitingActivity(machineState: MachineState): string | undefined {
    return Activities[machineState]
}
