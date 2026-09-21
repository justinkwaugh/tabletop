import { assert } from '@tabletop/common'

export const OperatingStepStates = [
    'LayingTrack',
    'PlacingStation',
    'RunningTrains',
    'DistributingEarnings',
    'BuyingTrains'
] as const
export type OperatingStepState = (typeof OperatingStepStates)[number]
export const BetweenCompaniesState = 'OperatingSet'

export function isOperatingStep(
    machineState: string,
    steps: readonly string[] = OperatingStepStates
): boolean {
    return steps.includes(machineState)
}

export function stateAfterOperatingStep(
    step: string,
    steps: readonly string[] = OperatingStepStates
): string {
    const position = steps.indexOf(step)
    assert(position >= 0, `${step} is not an operating step`)
    return steps[position + 1] ?? BetweenCompaniesState
}
