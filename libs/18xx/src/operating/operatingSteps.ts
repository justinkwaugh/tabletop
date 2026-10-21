import { assert } from '@tabletop/common'

export const OperatingStepStates = [
    'LayingTrack',
    'PlacingStation',
    'RunningTrains',
    'DistributingEarnings',
    'BuyingTrains'
] as const
/** Steps a title may add to its turn, such as share operations before construction. */
export const OptionalOperatingStepStates = ['ManagingShares'] as const
export type OperatingStepState =
    (typeof OperatingStepStates)[number] | (typeof OptionalOperatingStepStates)[number]
export const BetweenCompaniesState = 'OperatingSet'

export function isOperatingStep(
    machineState: string,
    steps: readonly string[] = [...OperatingStepStates, ...OptionalOperatingStepStates]
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
