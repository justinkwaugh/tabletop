import type { StagedSelectionState } from '@tabletop/frontend-components'
import type { Deployment } from '@tabletop/napoleons-triumph'
import { stagedSelection } from './stagedSelection.js'

type SetupSelectionValues = {
    edits: Deployment[]
    unit: string
    corps: string
}

export type SetupSelection = StagedSelectionState<SetupSelectionValues>

const setupSelection = stagedSelection<SetupSelectionValues>()(['edits', 'unit', 'corps'])

export function noSetupSelection(): SetupSelection {
    return setupSelection.empty()
}

export function editedDeployment(selection: SetupSelection): Deployment | undefined {
    return setupSelection.value(selection, 'edits')?.at(-1)
}

export function pickedSetupUnit(selection: SetupSelection): string | undefined {
    return setupSelection.value(selection, 'unit')
}

export function recordSetupEdit(selection: SetupSelection, deployment: Deployment): SetupSelection {
    const edits = setupSelection.value(selection, 'edits') ?? []
    return setupSelection.set(selection, 'edits', [...edits, deployment], 'manual')
}

export function toggleSetupUnit(selection: SetupSelection, unitId: string): SetupSelection {
    return pickedSetupUnit(selection) === unitId
        ? setupSelection.clearFrom(selection, 'unit')
        : setupSelection.set(selection, 'unit', unitId, 'manual')
}

export function pickedSetupCorps(selection: SetupSelection): string | undefined {
    return setupSelection.value(selection, 'corps')
}

export function toggleSetupCorps(selection: SetupSelection, commanderId: string): SetupSelection {
    const putDown = setupSelection.clearFrom(selection, 'unit')
    return pickedSetupCorps(selection) === commanderId
        ? putDown
        : setupSelection.set(putDown, 'corps', commanderId, 'manual')
}

export function hasManualSetupSelection(selection: SetupSelection): boolean {
    return setupSelection.hasManual(selection)
}

export function undoSetupSelection(selection: SetupSelection): SetupSelection {
    const edits = setupSelection.value(selection, 'edits') ?? []
    const picked = pickedSetupUnit(selection) ?? pickedSetupCorps(selection)
    if (picked !== undefined || edits.length <= 1) {
        return setupSelection.undo(selection)
    }
    return setupSelection.set(selection, 'edits', edits.slice(0, -1), 'manual')
}
