import type { StagedSelectionState } from '@tabletop/frontend-components'
import type { ArmySetup } from './armySetup.js'
import { stagedSelection } from './stagedSelection.js'

export enum DestinationKind {
    Corps = 'Corps',
    Detached = 'Detached',
    FixedBattery = 'FixedBattery'
}

/** Where units tapped in the pool go next: a corps, a post of their own, or the fixed battery's post. */
export type SetupDestination =
    | { kind: DestinationKind.Corps; commanderId: string }
    | { kind: DestinationKind.Detached }
    | { kind: DestinationKind.FixedBattery }

/** The set-up after one tap: the army as arranged, the destination open, and the unit in hand that the map is placing. */
export interface SetupStep {
    setup: ArmySetup
    open: SetupDestination
    heldUnitId?: string
}

type SetupSelectionValues = {
    steps: SetupStep[]
}

export type SetupSelection = StagedSelectionState<SetupSelectionValues>

const setupSelection = stagedSelection<SetupSelectionValues>()(['steps'])

export function noSetupSelection(): SetupSelection {
    return setupSelection.empty()
}

export function latestSetupStep(selection: SetupSelection): SetupStep | undefined {
    return setupSelection.value(selection, 'steps')?.at(-1)
}

export function sameDestination(a: SetupDestination, b: SetupDestination): boolean {
    return (
        a.kind === b.kind &&
        (a.kind !== DestinationKind.Corps ||
            b.kind !== DestinationKind.Corps ||
            a.commanderId === b.commanderId)
    )
}

export function recordSetupStep(selection: SetupSelection, step: SetupStep): SetupSelection {
    const steps = setupSelection.value(selection, 'steps') ?? []
    return setupSelection.set(selection, 'steps', [...steps, step], 'manual')
}

export function hasManualSetupSelection(selection: SetupSelection): boolean {
    return setupSelection.hasManual(selection)
}

/** Each tap of the set-up is a step of its own, so Undo takes back one tap at a time. */
export function undoSetupSelection(selection: SetupSelection): SetupSelection {
    const steps = setupSelection.value(selection, 'steps') ?? []
    return steps.length <= 1
        ? setupSelection.undo(selection)
        : setupSelection.set(selection, 'steps', steps.slice(0, -1), 'manual')
}
