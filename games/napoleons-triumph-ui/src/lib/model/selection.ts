import {
    clearStagedSelectionAtOrAfter,
    hasManualStagedSelection,
    popHighestManualStagedSelection,
    setStagedSelectionValue,
    type StagedSelectionSource,
    type StagedSelectionState
} from '@tabletop/frontend-components'
import type { CommandKind } from '@tabletop/napoleons-triumph'

/**
 * A corps or detached units picked up on the map, the units of it to command, how, and whether
 * an attack they threaten is announced as a Guard Attack.
 */
export type CommandSelectionValues = {
    group: string
    units: string[]
    command: CommandKind
    guard: true
}

export type CommandSelection = StagedSelectionState<CommandSelectionValues>

export const CommandStageOrder = [
    'group',
    'units',
    'command',
    'guard'
] as const satisfies readonly (keyof CommandSelectionValues)[]

type MissingStages = Exclude<keyof CommandSelectionValues, (typeof CommandStageOrder)[number]>
const stageCoverage: MissingStages extends never ? true : never = true
void stageCoverage

export function emptySelection(): CommandSelection {
    return {}
}

export function setCommandSelection<TStage extends keyof CommandSelectionValues>(
    selection: CommandSelection,
    stage: TStage,
    value: CommandSelectionValues[TStage],
    source: StagedSelectionSource
): CommandSelection {
    return setStagedSelectionValue<CommandSelectionValues, TStage>(
        selection,
        CommandStageOrder,
        stage,
        value,
        source
    )
}

export function clearCommandSelection(
    selection: CommandSelection,
    stage: keyof CommandSelectionValues
): CommandSelection {
    return clearStagedSelectionAtOrAfter<CommandSelectionValues, typeof stage>(
        selection,
        CommandStageOrder,
        stage
    )
}

export function hasManualCommandSelection(selection: CommandSelection): boolean {
    return hasManualStagedSelection<CommandSelectionValues>(selection, CommandStageOrder)
}

export function popCommandSelection(selection: CommandSelection): CommandSelection {
    return popHighestManualStagedSelection<CommandSelectionValues>(selection, CommandStageOrder)
        .nextState
}
