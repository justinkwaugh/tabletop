import type { StagedSelectionState } from '@tabletop/frontend-components'
import type { Deployment } from '@tabletop/napoleons-triumph'
import { stagedSelection } from './stagedSelection.js'

export type SetupSelectionValues = {
    edits: Deployment[]
    unit: string
}

export type SetupSelection = StagedSelectionState<SetupSelectionValues>

export const setupSelection = stagedSelection<SetupSelectionValues>()(['edits', 'unit'])

export function editedDeployment(selection: SetupSelection): Deployment | undefined {
    return setupSelection.value(selection, 'edits')?.at(-1)
}

export function recordSetupEdit(selection: SetupSelection, deployment: Deployment): SetupSelection {
    const edits = setupSelection.value(selection, 'edits') ?? []
    return setupSelection.set(selection, 'edits', [...edits, deployment], 'manual')
}

export function toggleSetupUnit(selection: SetupSelection, unitId: string): SetupSelection {
    return setupSelection.value(selection, 'unit') === unitId
        ? setupSelection.clearFrom(selection, 'unit')
        : setupSelection.set(selection, 'unit', unitId, 'manual')
}

export function undoSetupSelection(selection: SetupSelection): SetupSelection {
    const edits = setupSelection.value(selection, 'edits') ?? []
    if (setupSelection.value(selection, 'unit') !== undefined || edits.length <= 1) {
        return setupSelection.undo(selection)
    }
    return setupSelection.set(selection, 'edits', edits.slice(0, -1), 'manual')
}
