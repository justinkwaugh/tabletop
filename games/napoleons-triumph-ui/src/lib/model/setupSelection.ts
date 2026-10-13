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

/** What the player has turned to: the destination open and the unit in hand that the map is placing. It changes nothing in the army, so it is no step for Undo. */
export interface SetupFocus {
    open: SetupDestination
    heldUnitId?: string
}

/** The set-up as it stands: the army as arranged so far and what the player has turned to. */
export interface SetupStep extends SetupFocus {
    setup: ArmySetup
}

type SetupSelectionValues = {
    arrangements: ArmySetup[]
}

export type SetupSelection = StagedSelectionState<SetupSelectionValues>

const setupSelection = stagedSelection<SetupSelectionValues>()(['arrangements'])

export function noSetupSelection(): SetupSelection {
    return setupSelection.empty()
}

export function latestArrangement(selection: SetupSelection): ArmySetup | undefined {
    return setupSelection.value(selection, 'arrangements')?.at(-1)
}

export function sameDestination(a: SetupDestination, b: SetupDestination): boolean {
    return (
        a.kind === b.kind &&
        (a.kind !== DestinationKind.Corps ||
            b.kind !== DestinationKind.Corps ||
            a.commanderId === b.commanderId)
    )
}

export function recordArrangement(selection: SetupSelection, setup: ArmySetup): SetupSelection {
    const arrangements = setupSelection.value(selection, 'arrangements') ?? []
    return setupSelection.set(selection, 'arrangements', [...arrangements, setup], 'manual')
}

export function hasManualSetupSelection(selection: SetupSelection): boolean {
    return setupSelection.hasManual(selection)
}

/** Each change to the army is a step of its own, so Undo takes them back one at a time. */
export function undoSetupSelection(selection: SetupSelection): SetupSelection {
    const arrangements = setupSelection.value(selection, 'arrangements') ?? []
    return arrangements.length <= 1
        ? setupSelection.undo(selection)
        : setupSelection.set(selection, 'arrangements', arrangements.slice(0, -1), 'manual')
}
